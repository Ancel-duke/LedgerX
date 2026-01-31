# LedgerX

Production-grade, multi-tenant fintech platform for invoicing, payments, double-entry ledger, audit, fraud awareness, and diagnostics. This README reflects only implemented features.

---

### 1. LedgerX Overview

**What LedgerX is:** A full-stack application that lets organizations manage clients, invoices, payments, and a double-entry ledger with audit trails, fraud signals, and operational diagnostics. The backend is NestJS (TypeScript); the frontend is Next.js 14 (App Router).

**Core problem it solves:** Multi-tenant invoicing and payments with a proper accounting layer (append-only ledger), compliance-friendly audit logs, fraud risk awareness and policy enforcement, and operator-facing diagnostics and remediation—all behind a single codebase with clear org isolation.

**Target audience:** SMBs, finance teams, and organizations that need invoicing, payment recording, ledger integrity, and operational visibility without building each piece from scratch.

---

### 2. Key Capabilities (High-level)

- **Multi-tenant organizations and roles:** Organizations as isolation boundary; users can belong to multiple orgs with org-specific roles (ADMIN, MANAGER, MEMBER).
- **Auth and security:** JWT access and refresh tokens, password reset flow, token versioning for invalidation, role-based access, rate limiting on sensitive endpoints.
- **Invoicing, payments, ledger:** CRUD for clients and invoices; payments linked to invoices; double-entry ledger with append-only transactions and hash chain; automatic ledger posts on payment completion.
- **Audit, fraud, diagnostics:** Domain-event-driven audit and compliance records; fraud signal generation and org-level aggregation; diagnostics (aggregates, circuit state, reports, feature flags, scheduled jobs) and guarded remediation actions.
- **Observability and resilience:** Health (liveness/readiness), Prometheus-style metrics, circuit breakers for payment providers, structured logging with correlation IDs, graceful shutdown.

---

### 3. Architecture Summary

- **Backend:** NestJS on Node.js. PostgreSQL (Prisma) for core data; MongoDB (Mongoose) for activity logs. REST API under `/api`; health and metrics excluded from prefix (`/health`, `/health/ready`, `/metrics`).
- **Frontend:** Next.js 14 with App Router, React 18, TypeScript. TanStack Query for server state; Axios for API; Tailwind for layout and styling.
- **Payment providers:** Stripe and M-Pesa integrated via adapters and provider clients; webhooks handled with raw-body verification; circuit breakers wrap outbound calls.
- **Event-driven internals:** DomainEventBus for payment-completed, ledger-posted, invoice-overdue, password-reset, and remediation-executed events; audit, fraud, and diagnostics consume or emit events.
- **Deployment:** Backend on Render (Node, bind to `0.0.0.0`, PORT from env, health at `/health`). Frontend on Netlify. No Docker in the current setup.

---

### 4. Backend Features (Detailed but concise)

- **Organizations and roles:** Organizations with slug; UserOrganization and Role (ADMIN, MANAGER, MEMBER) per org; org-scoped guards and queries.
- **Auth:** Register (user + default org), login (access + refresh JWT), refresh endpoint, get-me and switch-organization. Password reset: forgot (token, email link via SMTP), reset (validate token, update password, increment tokenVersion). JWT strategies validate tokenVersion for invalidation. PasswordResetToken cleanup scheduler.
- **Clients, invoices, payments:** Full CRUD with org scope. Invoices have line items, tax, status (DRAFT, SENT, PAID, OVERDUE, CANCELLED); status and balances updated from payments. Payments link to invoices; methods include CREDIT_CARD, BANK_TRANSFER, etc.
- **Ledger:** Double-entry model (LedgerAccount, LedgerTransaction, LedgerEntry, LedgerHash). Post-transaction API; balance and account queries. LedgerBootstrapService creates default Cash and Revenue accounts for new orgs. Payment completion posts ledger entries.
- **Payment orchestration and webhooks:** PaymentIntent model (Stripe/M-Pesa, idempotency by providerRef + org). WebhooksController with raw body for Stripe/M-Pesa; adapters parse payloads; PaymentOrchestratorService creates payments, emits events, posts ledger. StripeProviderClient and MpesaProviderClient wrap outbound calls with circuit breaker; M-Pesa OAuth and STK Push implemented.
- **Fraud detection and policy:** FraudDetectionEvent, FraudSignal, FraudOrgAggregate. FraudDetectionService subscribes to events; FraudRiskService computes org risk and blocking policy. Fraud aggregation scheduler. Payments and orchestrator check shouldBlockOrganization / shouldBlockPayment before processing.
- **Audit and compliance:** DomainEventAudit and AuditComplianceRecord. AuditComplianceService consumes domain events; AuditComplianceRecordService for richer trails. Read-only API: entity audit history, time-range export. Restricted to ADMIN/MANAGER.
- **Diagnostics, remediation, feature flags:** DiagnosticsService (aggregates, rule-based reports, optional LLM summary); report history persisted. RemediationService for allowed actions (e.g. RESTART_PROCESS, CLEAR_CIRCUIT_BREAKER, TOGGLE_FEATURE_FLAG), fully audited. FeatureFlag model and FeatureFlagsService (DB-backed, scoped). ScheduledJobsRegistryService lists jobs. RestartService (Render deploy hook or process.exit). Diagnostics API restricted to ADMIN/MANAGER.
- **Scheduled jobs:** Overdue invoices, password-reset token cleanup, fraud aggregation, optional audit cleanup; all registered for diagnostics visibility.

---

### 5. Frontend Features

- **Auth and org switching:** Login, register, forgot password, reset password. AuthProvider with user, organization, organizations, refresh, switchOrganization. Protected routes; token refresh interceptor.
- **Dashboard layout:** Nav: Dashboard, Invoices, Clients, Payments, Ledger, Analytics, Activity; Audit and Diagnostics only for ADMIN/MANAGER. User dropdown: Profile, Settings, Sign out. Org switcher when multiple orgs. Hamburger and slide-over drawer on small screens; active route highlight.
- **Pages:** Dashboard (overview); Invoices (list, new, detail); Clients (list, new, edit); Payments (list, new); Ledger (accounts, balances, transactions, transaction detail); Analytics (stats, revenue, invoice status, payment completion charts); Activity (timeline); Audit (entity history, export); Fraud & Risk (org risk, flagged items); Diagnostics & Health (health badge, KPI cards, circuit breaker, reports, jobs, feature flags, optional raw view); Settings (protected).
- **Responsiveness and UX:** Mobile nav; overflow-x on tables; typography and spacing; error boundary; toast context; API client with unwrapResponse/unwrapListResponse; typed services. Role-gated nav and “not authorized” messaging where applicable.

---

### 6. Observability, Reliability & Security

- **Health checks:** GET `/health` (liveness); GET `/health/ready` (readiness with DB probe). Used by Render for health check path.
- **Metrics and diagnostics:** Prometheus-style metrics (auth failures, payment failures, circuit opens, rate-limit exceeded); diagnostics snapshot for aggregates and circuits; no raw JSON in primary diagnostics UI—KPI cards and structured sections.
- **Circuit breakers:** Per-provider (Stripe, M-Pesa); outbound provider calls go through provider clients; failures open circuit and avoid cascading load.
- **Rate limiting:** SensitiveEndpointsRateLimitGuard (per-IP and per-org); optional Redis-backed store for distributed limits.
- **Structured logging and correlation IDs:** RequestContextStore (AsyncLocalStorage); middleware/interceptor set correlation ID; structured JSON logs; secret redaction.
- **Graceful shutdown:** Nest enableShutdownHooks(); SIGTERM handled for clean exit on Render.

---

### 7. Testing

- **E2E scope:** Backend E2E with Jest; smoke tests for health, auth (register, login), clients, invoices, payments. Tests use a dedicated test database.
- **Reset DB strategy:** `npm run test:reset-db` runs Prisma migrate reset (force). `npm run test:e2e` runs reset then E2E; `npm run test:e2e:only` runs E2E without reset for debugging.
- **What is covered:** Critical paths for health, auth, and core CRUD. No full UI E2E; no Stripe/M-Pesa live provider tests in default suite. Webhook idempotency E2E can be run when STRIPE_WEBHOOK_SECRET is set (test value).

---

### 8. Configuration & Environment

- **Required (minimum viable):** DATABASE_URL (PostgreSQL), MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET. API_PREFIX, PORT, NODE_ENV have defaults. CORS_ORIGIN defaults to localhost; can be comma-separated for multiple origins.
- **Optional integrations:** Stripe (webhook secret, keys for live usage); M-Pesa (base URL, consumer key/secret, shortcode, passkey, callback, timeout); Redis (REDIS_URL for rate limiting); SMTP (for password-reset emails); LLM (OpenAI key, model, timeout for diagnostics summaries); RENDER_DEPLOY_HOOK_URL or DEPLOY_HOOK_URL for restart remediation; audit/fraud cron expressions; feature flags and diagnostics retention/LLM flags. App starts without optional vars; corresponding features degrade or are disabled.

---

### 9. Deployment

- **Backend (Render):** Root directory `backend`. Build: NODE_ENV=development npm install, npx prisma generate, npm run build. Start: npm run start:prod (or npm run start:render to run prisma migrate deploy then start). Health Check Path: `/health`. Bind to 0.0.0.0; PORT from env. See backend/DEPLOY_RENDER.md.
- **Frontend (Netlify):** Build and start per Next.js; set NEXT_PUBLIC_API_URL to backend API base (e.g. https://your-backend.onrender.com/api). See frontend/DEPLOY_NETLIFY.md.
- **Health paths and CORS:** Health is at `/health` and `/health/ready` (not under /api). CORS must include frontend origin(s); backend supports comma-separated CORS_ORIGIN and defaults for localhost and a Netlify URL.

---

### 10. Non-Goals

- LedgerX is **not** a general-purpose ERP or CRM; it focuses on invoicing, payments, ledger, audit, fraud awareness, and diagnostics.
- It is **not** a bank or payment processor; it records payments and can integrate with Stripe and M-Pesa; it does not replace provider compliance or licensing.
- It does **not** provide real-time collaboration or native mobile apps; the UI is responsive web.
- It does **not** currently use Docker or Kubernetes; deployment is Render + Netlify with Node and Next.js runtimes.
- Heavy unit-test coverage is **not** a current focus; E2E smoke tests and operational diagnostics are prioritized for confidence.

---

**Built with NestJS, Next.js, PostgreSQL, and MongoDB.**
