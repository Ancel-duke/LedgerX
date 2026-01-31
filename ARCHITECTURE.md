# LedgerX Architecture

This document explains how LedgerX is structured and why. Audience: senior backend engineers, security and platform reviewers, senior fullstack engineers, hiring managers. No marketing fluff; only implemented behavior and intentional trade-offs.

---

### 1. Architectural Goals

- **Multi-tenancy:** Every business entity (client, invoice, payment, ledger, audit, fraud) is scoped to an organization. Users can belong to multiple orgs; the active org is selected per session. No database-per-tenant; shared schema with org-scoped queries and guards.
- **Auditability and compliance:** All material actions flow through a domain event bus or are recorded explicitly. Audit and compliance records are written for domain events and remediations. Activity logs (MongoDB) and domain-event audit (PostgreSQL) support entity history and time-range export.
- **Resilience:** Payment provider calls go through circuit breakers. Health (liveness/readiness) and metrics expose operational state. Graceful shutdown on SIGTERM. Uncaught exceptions and unhandled rejections log and exit(1) so the process restarts cleanly.
- **Operational visibility:** Diagnostics are first-class: aggregates (auth/payment failures, circuit opens, rate limits), circuit state, diagnostic reports (rule-based, optional LLM summary), report history, scheduled jobs registry, feature flags. Remediation actions (e.g. restart, clear circuit, toggle flag) are guarded and audited.
- **Incremental extensibility:** New payment providers fit behind adapters and provider clients. New domain events can be published and consumed by audit, fraud, or diagnostics without changing core payment or ledger flows. Feature flags allow toggling behavior without redeploy.

---

### 2. High-Level System Diagram (described in text)

```
[Browser] --> [Netlify: Next.js 14]
                    |
                    | HTTPS, NEXT_PUBLIC_API_URL
                    v
[Render: NestJS] <-- API + /health, /health/ready, /metrics
    |
    |-- PostgreSQL (Prisma): organizations, users, roles, clients, invoices,
    |   payments, payment intents, ledger (accounts, transactions, entries, hashes),
    |   audit/compliance records, fraud events/signals/aggregates,
    |   diagnostic report history, feature flags, password reset tokens
    |
    |-- MongoDB (Mongoose): activity logs (high-volume, flexible schema)
    |
    |-- Outbound (behind circuit breakers):
    |   Stripe API, M-Pesa API
    |
    |-- Optional: Redis (rate limiting), SMTP (password reset emails),
    |   OpenAI (diagnostics LLM), Render deploy hook (restart remediation)
```

- **Frontend:** Next.js 14 App Router, React 18, TypeScript. TanStack Query for server state; Axios API client with refresh interceptor. Auth and org context in React; role-gated navigation.
- **Backend:** NestJS, single process. Global prefix `/api`; health and metrics excluded. CORS configurable; raw body for webhook routes only.
- **PostgreSQL:** Core transactional and compliance data. Prisma ORM; migrations applied at deploy (build or start script).
- **MongoDB:** Activity logs only. Chosen for flexible schema and write volume; not used for money or identity.
- **External:** Stripe and M-Pesa (payments); SMTP (password reset); optional Redis, OpenAI, Render deploy hook.

---

### 3. Backend Architecture

- **Modular NestJS:** One module per domain: Auth, Users, Organizations, Clients, Invoices, Payments, Ledger, ActivityLog, Analytics, DomainEvents, AuditCompliance, FraudDetection, Diagnostics, Health, Metrics, RateLimit, CircuitBreaker, RequestContext, Config, Postgres, Mongo, Email, ScheduledJobs, InFlightFinancial. Shared guards (JWT, org, roles), interceptors (transform, errors, observability, request-context), and pipes (validation) are global.
- **Domain-oriented modules:** Auth owns login, register, refresh, get-me, switch-org, forgot/reset password. Payments own CRUD and orchestration; Ledger owns double-entry and bootstrap; AuditCompliance and FraudDetection subscribe to domain events; Diagnostics owns aggregates, reports, jobs, feature flags, remediation.
- **Guards, interceptors, pipes:** JwtAuthGuard and OrganizationGuard on protected routes. RolesGuard (ADMIN/MANAGER) on audit and diagnostics. SensitiveEndpointsRateLimitGuard (per-IP and per-org). TransformInterceptor wraps responses; ErrorsInterceptor normalizes exceptions; ObservabilityInterceptor records metrics; RequestContextInterceptor sets correlation ID. ValidationPipe with whitelist and transform.
- **Schedulers:** Overdue invoices, password-reset token cleanup, fraud aggregation, optional audit cleanup; all registered in ScheduledJobsRegistryService for diagnostics visibility.

---

### 4. Multi-Tenancy Model

- **Organization as isolation boundary:** Organization is the tenant. All queries that touch clients, invoices, payments, ledger, or org-specific audit/fraud use `organizationId` from the current context (set by OrganizationGuard from JWT/header or default org).
- **UserOrganization and Role:** UserOrganization links User to Organization with a Role (ADMIN, MANAGER, MEMBER). Roles are org-scoped. Get-me returns user and list of orgs; switch-organization updates the active org for the session.
- **Org-scoped queries and guards:** Services accept organizationId (from controller/guard) and filter all reads/writes. Guards ensure the user has access to the requested org.
- **Org switching:** Frontend calls switch-organization; backend returns new tokens or session data; frontend updates context and refetches as needed. No DB-per-tenant; same schema and connection pool.

---

### 5. Event-Driven Core

- **DomainEventBus:** In-process, synchronous event bus. Events: PaymentCompleted, LedgerTransactionPosted, InvoiceOverdue, PasswordResetRequested, PasswordResetCompleted, DiagnosticsRemediationExecuted. Publishers: payment orchestrator, ledger service, invoice scheduler, auth service, remediation service.
- **Why events:** Decouples payment/ledger completion from audit, fraud, and diagnostics. Audit and fraud can subscribe without changing payment or ledger code. New subscribers can be added without touching producers.
- **Audit, fraud, diagnostics as subscribers:** AuditComplianceService and FraudDetectionService subscribe to domain events and write to DomainEventAudit, AuditComplianceRecord, FraudDetectionEvent, FraudSignal. Diagnostics consumes metrics and aggregates; remediation emits DiagnosticsRemediationExecuted.
- **Benefits:** Single place to add cross-cutting behavior; clear audit trail of what happened. **Limitations:** Synchronous; no out-of-process queue. Failures in a subscriber can affect the request; error handling and idempotency in subscribers are important.

---

### 6. Payments & Ledger Integrity

- **Payment intents and idempotency:** PaymentIntent stores provider (Stripe/M-Pesa), providerRef, organizationId, status. Webhooks and internal flows resolve intents by providerRef + org to avoid duplicate payments or double ledger posts.
- **Webhook handling and raw body verification:** Stripe and M-Pesa webhook routes use Express raw body middleware so signature verification gets the exact payload. Parsed JSON is then passed to adapters and the orchestrator.
- **Double-entry ledger:** LedgerAccount (type: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE), LedgerTransaction (reference to source), LedgerEntry (account, direction DEBIT/CREDIT, amount). Every transaction balances; LedgerService posts atomically.
- **Append-only hash chain:** LedgerHash stores integrity data for the ledger (e.g. chain of transaction hashes). Ledger is append-only; no updates or deletes on posted entries.

---

### 7. Fraud & Risk Architecture

- **Signal generation:** FraudDetectionService subscribes to domain events (e.g. payment completed, high velocity). It creates FraudDetectionEvent and FraudSignal records. Signals can be attached to orgs, users, or transactions.
- **Aggregation job:** Fraud aggregation scheduler runs periodically; it aggregates signals into FraudOrgAggregate per organization (counts, risk level). Stored in PostgreSQL for fast reads.
- **Org-level risk:** FraudRiskService exposes shouldBlockOrganization(orgId) and shouldBlockPayment(orgId, paymentContext). Policy is based on aggregates and configurable thresholds.
- **Enforcement points:** PaymentsService (create/update) and PaymentOrchestratorService (process payment intent) call the risk service before creating or completing payments. On block, they return a clear error to the client.

---

### 8. Diagnostics & Self-Protection

- **Health and readiness:** GET `/health` returns liveness (process up). GET `/health/ready` checks DB (e.g. Prisma $queryRaw SELECT 1) and returns readiness; used by Render and load balancers.
- **Metrics snapshot:** MetricsService maintains counters (auth failures, payment failures, circuit opens, rate-limit exceeded). getDiagnosticsSnapshot() returns current aggregates and circuit state for the diagnostics API (no raw Prometheus scrape in app; metrics endpoint available for Prometheus if needed).
- **Circuit breakers:** CircuitBreakerService is global; StripeProviderClient and MpesaProviderClient wrap every outbound call with execute(providerKey, fn). Open circuit fails fast and avoids cascading failure.
- **Remediation actions:** RemediationService executes only allowed actions (e.g. RESTART_PROCESS, CLEAR_CIRCUIT_BREAKER, TOGGLE_FEATURE_FLAG). Each execution is audited (actor, action, payload). Restart uses RENDER_DEPLOY_HOOK_URL or process.exit() as fallback.
- **Feature flags:** FeatureFlag model in PostgreSQL; FeatureFlagsService resolves by key and optional org/environment. Used to toggle optional behavior (e.g. LLM in diagnostics) without redeploy.

---

### 9. Security Architecture

- **Auth model:** JWT access token (short-lived) and refresh token (longer-lived). Passport JWT and refresh strategies validate tokens. Passwords hashed with bcrypt; never logged or returned.
- **Token invalidation:** User has tokenVersion. On password reset, tokenVersion is incremented; JWT strategies reject tokens with stale version. PasswordResetToken is single-use and time-limited; deleted after use or by cleanup job.
- **Rate limiting:** SensitiveEndpointsRateLimitGuard applies per-IP and per-org limits. Optional Redis store for distributed limits. Metrics record rate-limit exceeded.
- **Role-based access:** Audit and diagnostics APIs are restricted to ADMIN and MANAGER via RolesGuard. Frontend hides Audit and Diagnostics nav for other roles and shows “not authorized” if accessed directly.
- **Secrets and logging:** Validation and config load secrets from env; they are not logged. Structured logger redacts known secret keys. Request context (correlation ID) is attached to logs for tracing.

---

### 10. Frontend Architecture

- **App Router:** Next.js 14 App Router. Routes: `/`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/dashboard/*`, `/settings` (redirect to dashboard/settings). Layout and providers at root; dashboard has its own layout (nav, user menu, org switcher).
- **Auth and org context:** AuthProvider holds user, organization, organizations, login, logout, refresh, switchOrganization. Protected routes redirect unauthenticated users. API client attaches access token and refreshes on 401 using refresh token.
- **API client strategy:** Axios instance with base URL from NEXT_PUBLIC_API_URL. Response unwrapping (unwrapResponse, unwrapListResponse, asArray) centralizes handling of backend shape (data, meta). Typed services per domain (auth, clients, invoices, payments, ledger, analytics, activity, audit, fraud, diagnostics, health).
- **Role-gated navigation:** Nav links for Audit and Diagnostics are rendered only when user role is ADMIN or MANAGER. Corresponding pages show “not authorized” for others.
- **Responsiveness:** Hamburger menu and slide-over drawer on small screens; tables with overflow-x; consistent padding (e.g. px-4 sm:px-6 lg:px-8); typography scales. No separate native mobile app.

---

### 11. Deployment & Runtime

- **Render (backend):** Node runtime. Root directory `backend`. Build installs deps (NODE_ENV=development so devDependencies are available), runs prisma generate and npm run build. Start runs node dist/main; optional start:render runs prisma migrate deploy then node dist/main. PORT is set by Render; app binds to 0.0.0.0 so external traffic is accepted. Health Check Path set to `/health`. Graceful shutdown on SIGTERM.
- **Netlify (frontend):** Next.js build and serverless/static as per Netlify config. NEXT_PUBLIC_API_URL must point to backend API base. No server-side secrets in frontend.
- **No Docker assumption:** Current deployment uses Render and Netlify native runtimes. No Dockerfile or Kubernetes in repo. Migrations run as part of build or start, not a separate init container.
- **Graceful shutdown:** Nest enableShutdownHooks() registers SIGTERM/SIGINT; Nest closes connections and exits. Uncaught and unhandled handlers log and exit(1) so the process does not hang in a bad state.

---

### 12. Known Limitations

- **Single region/process:** Backend is one process per Render service. No built-in horizontal scaling or multi-region; scale by increasing instance size or replicas on Render.
- **Synchronous event bus:** Domain events are in-process and synchronous. A slow or failing subscriber can delay or fail the request. No dead-letter or retry at the bus level.
- **MongoDB for activity only:** Activity logs are in MongoDB; core data is in PostgreSQL. Two stores to operate and back up; chosen for schema flexibility and volume for logs.
- **No built-in queue:** No Redis/RabbitMQ/SQS for background jobs. Schedulers run in-process; long-running work would block. Acceptable for current job set (overdue, cleanup, fraud aggregation).
- **Diagnostics LLM optional:** LLM summarization for diagnostic reports is feature-flagged and optional; without it, reports are rule-based only. No commitment to a specific LLM provider or SLA.
- **E2E coverage is smoke-level:** E2E tests cover health, auth, and core CRUD paths. No full UI E2E; no live Stripe/M-Pesa in CI. Sufficient for regression and deploy confidence; not for full product coverage.

These limitations are accepted to ship a production-capable multi-tenant fintech app with clear boundaries (single process, two databases, optional integrations) and a path to extend (e.g. add a queue or more E2E) without rewriting core architecture.
