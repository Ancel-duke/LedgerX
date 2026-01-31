# LedgerX Architectural Decisions

ADR-style record of why key choices were made. Written after real implementation and production-oriented deployment. Honest, reasoned, slightly opinionated.

---

### Decision: NestJS over Express / Fastify directly

**Context:** Backend needed structure for multi-tenant fintech: auth, payments, ledger, audit, fraud, diagnostics, multiple databases, guards, interceptors, schedulers. A bare Express or Fastify app would require a lot of custom wiring and convention.

**Decision:** Use NestJS as the backend framework. All core domains are Nest modules; guards, interceptors, pipes, and config are first-class.

**Alternatives considered:** Express + manual layering; Fastify + manual layering; other Node frameworks (e.g. Adonis, LoopBack).

**Why this choice:** NestJS gives dependency injection, module boundaries, and built-in support for guards, interceptors, pipes, and config. Multi-database (Prisma + Mongoose), multiple auth strategies (JWT, refresh), and global interceptors are straightforward. The learning curve pays off for a team that values structure over minimal boilerplate.

**Consequences (positive & negative):** Positive: consistent patterns, testability via DI, clear separation of controllers/services/guards. Negative: heavier than Express; some Nest idioms and decorators must be learned; upgrade path tied to Nest releases.

---

### Decision: PostgreSQL + Prisma for core data

**Context:** Core data is relational (organizations, users, roles, clients, invoices, payments, ledger, audit, fraud, feature flags). Need migrations, type safety, and a single source of truth for money and identity.

**Decision:** Use PostgreSQL for all core transactional and compliance data. Use Prisma as the ORM: schema in `schema.prisma`, migrations in version control, generated client for type-safe queries.

**Alternatives considered:** MySQL/MariaDB; SQLite (rejected for production multi-tenant); TypeORM or raw SQL.

**Why this choice:** PostgreSQL is robust, widely supported on Render and elsewhere, and supports ACID and constraints. Prisma gives declarative schema, migration history, and a typed client that reduces runtime schema mistakes. Single DB for core data simplifies backups and consistency.

**Consequences (positive & negative):** Positive: strong consistency, migrations as code, good tooling (Prisma Studio, migrate deploy). Negative: schema changes require migrations and care in production; Prisma version upgrades can require migration of generated code.

---

### Decision: MongoDB for activity logs

**Context:** Activity logs are high-volume, flexible in shape (different entity types, optional metadata), and not the source of truth for money or identity. Query patterns are “recent by org” and “by entity”; no complex joins.

**Decision:** Store activity logs in MongoDB via Mongoose. PostgreSQL holds organizations, users, invoices, payments, ledger, audit, fraud, diagnostics; MongoDB holds only activity log documents.

**Alternatives considered:** PostgreSQL JSONB for logs; same PostgreSQL with a dedicated “events” or “activity” table; external log store (e.g. Elasticsearch).

**Why this choice:** MongoDB allows flexible schema per log type and scales writes well for logs. Keeping logs out of PostgreSQL avoids bloating the core DB and keeps audit/compliance tables focused. Separation of “money/identity” (PostgreSQL) from “who did what” (MongoDB) is clear for compliance and backup policies.

**Consequences (positive & negative):** Positive: schema flexibility, write throughput, clear separation. Negative: two data stores to operate, back up, and secure; no cross-DB transactions (acceptable for logs).

---

### Decision: Event-driven internal architecture

**Context:** Payment completion and ledger posts should drive audit, fraud, and diagnostics without coupling those domains to payment or ledger code. New consumers (e.g. new fraud rules) should plug in without changing producers.

**Decision:** Introduce an in-process DomainEventBus. Payment orchestrator, ledger service, auth, and remediation publish events; AuditComplianceService and FraudDetectionService subscribe. Events are synchronous, in-process.

**Alternatives considered:** Direct service calls from payment/ledger to audit/fraud; out-of-process queue (Redis/RabbitMQ/SQS) from day one.

**Why this choice:** Direct calls would tightly couple payment and ledger to every consumer. A queue would add operational complexity (broker, retries, DLQ) we did not need for current scale. In-process events give decoupling and a single place to add subscribers without changing producers; we can introduce a queue later if we need async or cross-service events.

**Consequences (positive & negative):** Positive: decoupled domains, clear audit trail of “what happened,” easy to add subscribers. Negative: synchronous—slow or failing subscriber can affect the request; no built-in retry or dead-letter.

---

### Decision: Double-entry ledger with hash chain

**Context:** Payments and revenue need a proper accounting layer: immutable, auditable, and verifiable. Single-entry or “balance only” is not sufficient for finance and compliance.

**Decision:** Implement a double-entry ledger: LedgerAccount, LedgerTransaction, LedgerEntry (DEBIT/CREDIT), and LedgerHash for an append-only hash chain. LedgerService posts transactions atomically; payment completion triggers ledger posts. No updates or deletes on posted entries.

**Alternatives considered:** Single-entry balances; event-sourced ledger with separate read models; external ledger service.

**Why this choice:** Double-entry is the standard for financial systems; every transaction balances and can be reconciled. Hash chain supports integrity checks (e.g. detect tampering). In-app implementation keeps latency low and avoids another service to run. Append-only and no updates simplify reasoning and audit.

**Consequences (positive & negative):** Positive: integrity, auditability, standard accounting model. Negative: more complexity than a single balance column; correcting errors requires compensating entries, not edits.

---

### Decision: JWT access + refresh tokens

**Context:** Frontend needs to call API on behalf of a user. Session cookies would require same-site or careful CORS/cookie config when frontend and API are on different origins (e.g. Netlify + Render). Stateless auth reduces server-side session store.

**Decision:** Use JWT access tokens (short-lived) and refresh tokens (longer-lived). Passport JWT and refresh strategies validate tokens. Frontend stores tokens (e.g. memory/localStorage) and sends access token in Authorization header; on 401, frontend uses refresh token to get a new access token.

**Alternatives considered:** Session cookies only; long-lived access tokens only; OAuth2 with external IdP only.

**Why this choice:** JWTs work across origins without cookie domain tricks. Short-lived access tokens limit exposure if leaked; refresh token allows renewal without re-login. No server-side session store to scale or back up. Trade-off is token revocation: we address that with token versioning (see next decision).

**Consequences (positive & negative):** Positive: stateless, cross-origin friendly, standard pattern. Negative: refresh token must be stored securely; revocation before expiry requires a mechanism—hence tokenVersion.

---

### Decision: Token versioning for invalidation

**Context:** Password reset or “logout everywhere” must invalidate existing JWTs without maintaining a per-token blocklist in the DB.

**Decision:** Add a `tokenVersion` field to User. On password reset (or explicit “invalidate all”), increment tokenVersion. JWT payload does not include it by default; we validate it in JwtStrategy and JwtRefreshStrategy by loading the user and comparing version. Stale tokens are rejected.

**Alternatives considered:** Blacklist of token IDs in DB; very short access token only; session store.

**Why this choice:** Single integer per user; one DB read per validated request (user lookup already needed for roles/org). No unbounded blacklist. Incrementing version invalidates all previous tokens at once. Fits JWT + refresh model without adding a session store.

**Consequences (positive & negative):** Positive: simple, bounded storage, immediate invalidation. Negative: every authenticated request must hit DB (or cache) for user + tokenVersion; we accept that for correctness.

---

### Decision: Org-scoped multi-tenancy (not DB-per-tenant)

**Context:** Multiple organizations (tenants) must be isolated. Options: separate DB per tenant vs. shared schema with org-scoped queries.

**Decision:** Single PostgreSQL schema; every tenant-scoped table has organizationId (or equivalent). OrganizationGuard and service layer enforce org scope on every read/write. No separate database or schema per tenant.

**Alternatives considered:** Database per tenant; schema per tenant (PostgreSQL schemas); row-level security (RLS) only.

**Why this choice:** DB-per-tenant adds operational and migration overhead (N databases to migrate, back up, connect). Shared schema with strict org scoping is simpler to run and migrate. Guards and services are the single place that enforce “this user can only see this org’s data.” RLS could be added later as defense in depth.

**Consequences (positive & negative):** Positive: one schema to migrate, one connection pool, simpler backups. Negative: one bad query or missing guard could leak cross-tenant data; code review and tests must enforce org scoping everywhere.

---

### Decision: Stripe + M-Pesa via adapters

**Context:** Payments come from Stripe (cards) and M-Pesa (mobile money). Webhooks, idempotency, and ledger posts must work the same regardless of provider. We do not want payment logic full of if (provider === 'stripe') branches.

**Decision:** Define a webhook adapter interface (parse payload, extract idempotency key, amount, status). StripeAdapter and MpesaAdapter implement it. PaymentOrchestratorService receives parsed, provider-agnostic payloads; it creates/updates PaymentIntent and Payment, emits events, posts ledger. Outbound calls go through StripeProviderClient and MpesaProviderClient (with circuit breaker).

**Alternatives considered:** One big webhook handler per provider; third-party “payment abstraction” product.

**Why this choice:** Adapters isolate provider-specific parsing and signing; orchestrator stays clean. Provider clients centralize circuit breaking and timeouts. Adding a new provider means a new adapter and client, not rewriting orchestration.

**Consequences (positive & negative):** Positive: clear boundaries, testable orchestrator with mocked adapters. Negative: more files and types; provider quirks still live in adapters and must be maintained.

---

### Decision: Circuit breaker pattern

**Context:** Stripe and M-Pesa can be slow or down. Cascading failures and hung requests are unacceptable. We need to fail fast and optionally degrade (e.g. show “payment provider temporarily unavailable”).

**Decision:** Global CircuitBreakerService; StripeProviderClient and MpesaProviderClient wrap every outbound call with execute(providerKey, fn). On repeated failures, circuit opens and subsequent calls fail immediately. Half-open state allows probe requests. Metrics record circuit state for diagnostics.

**Alternatives considered:** Retries only; timeouts only; no outbound protection.

**Why this choice:** Circuit breakers prevent a failing provider from tying up threads and causing timeouts across the app. Combined with timeouts, we get predictable behavior: fast failure when the provider is bad, and visibility in diagnostics (circuit open/half-open).

**Consequences (positive & negative):** Positive: resilience, clear metrics, better UX (fast error instead of long hang). Negative: configuration (thresholds, timeouts) and testing of open/half-open behavior required.

---

### Decision: Diagnostics & remediation as first-class features

**Context:** Operators and senior engineers need to see health, metrics, circuit state, and report history without SSH or raw JSON. In rare cases, they need to run safe remediations (e.g. clear circuit, restart, toggle flag) in a controlled way.

**Decision:** Implement a Diagnostics module: aggregates (auth/payment failures, circuit opens, rate limits), circuit state, rule-based diagnostic reports (with optional LLM summary), report history, scheduled jobs registry, feature flags. RemediationService executes only an allowlisted set of actions; every execution is audited. Diagnostics API and UI are restricted to ADMIN/MANAGER. UI uses KPI cards and structured sections—no raw JSON in the main view; “raw diagnostic data” is behind an advanced toggle.

**Alternatives considered:** Dev-only debug endpoints; logs and metrics only; no remediation actions.

**Why this choice:** Production systems need operator visibility and controlled remediation. First-class diagnostics reduce “hop into the server and grep” and make it clear what the system is doing. Audited remediation keeps actions safe and traceable.

**Consequences (positive & negative):** Positive: operational clarity, safer remediation, audit trail. Negative: more code and UI to maintain; remediation must stay allowlisted and well-tested.

---

### Decision: Feature flags in DB (not env-only)

**Context:** Some behavior (e.g. LLM in diagnostics, experimental flows) should be toggled without redeploy. Env vars require a new deploy or restart to change.

**Decision:** FeatureFlag model in PostgreSQL; FeatureFlagsService resolves by key and optional org/environment. Flags can be toggled via DB (or future admin UI) without redeploy. Env vars still drive “is this integration configured” (e.g. OPENAI_API_KEY); flags drive “is this feature on for this org.”

**Alternatives considered:** Env-only toggles; external feature-flag service (LaunchDarkly, etc.).

**Why this choice:** DB-backed flags are under our control, auditable, and work with our existing Prisma/PostgreSQL stack. We can scope by org or environment. No dependency on a third-party flag service for core toggles. External service could be added later for A/B or more advanced targeting.

**Consequences (positive & negative):** Positive: toggle without deploy, org-scoped, no extra vendor. Negative: DB read to resolve flags (can be cached); we do not have a full UI for non-technical users yet.

---

### Decision: No Docker in current architecture

**Context:** Deployment targets are Render (backend) and Netlify (frontend). Both support native Node and Next.js runtimes. Docker would add a layer (build image, registry, run container) that we do not strictly need for current scale.

**Decision:** Do not introduce Dockerfiles or container orchestration for the current deployment. Backend runs as `node dist/main` on Render; frontend builds and runs on Netlify. Migrations run as part of build or start (e.g. start:render).

**Alternatives considered:** Docker for backend and/or frontend; Kubernetes; Docker Compose for local dev.

**Why this choice:** Render and Netlify work well with Git-based deploy and native runtimes. Adding Docker would add build and image management without solving a current pain. If we move to a container-based platform later, we can add Dockerfiles then; the app has no host-specific assumptions.

**Consequences (positive & negative):** Positive: simpler CI/CD, no image registry or container runtime to manage. Negative: less portability to other platforms; local dev matches “npm run” rather than “docker run.”

---

### Decision: Render + Netlify deployment choice

**Context:** Backend and frontend need hosting with minimal ops. Backend needs PostgreSQL (or external DB), health checks, and graceful shutdown. Frontend is static/SSR Next.js and must call backend on a different origin.

**Decision:** Backend on Render (Node, PostgreSQL available, health check path, PORT from env). Frontend on Netlify (Next.js support, env for NEXT_PUBLIC_API_URL). Backend binds to 0.0.0.0 and uses PORT; health at `/health`. CORS configured for frontend origin(s).

**Alternatives considered:** Vercel for both; single platform for both; self-hosted VPS; Kubernetes.

**Why this choice:** Render gives a simple path for Node + Postgres and is well-documented for health and shutdown. Netlify is a good fit for Next.js and static assets. Separation allows independent deploy and scaling. We documented Render (DEPLOY_RENDER.md) and Netlify (DEPLOY_NETLIFY.md) with exact steps and health paths.

**Consequences (positive & negative):** Positive: managed runtimes, clear docs, CORS and health aligned. Negative: two platforms to configure; cold starts on free tier; no single “deploy everything” button without custom CI.

---

### Decision: E2E focus over heavy unit testing

**Context:** Limited time; we want confidence that critical paths work after deploy. Unit tests for every service would increase coverage but also maintenance. E2E tests hit real HTTP and DB and catch integration bugs.

**Decision:** Invest in backend E2E smoke tests: health, auth (register, login), clients, invoices, payments. Use a dedicated test database; `npm run test:e2e` resets DB then runs E2E; `npm run test:e2e:only` runs E2E without reset for debugging. No comprehensive unit test suite for every module; diagnostics and operational visibility (health, metrics, reports) supplement confidence.

**Alternatives considered:** High unit test coverage only; no E2E; full E2E including UI and payment providers.

**Why this choice:** E2E smoke tests give the most bang for the buck: they verify that the app starts, auth works, and core CRUD works against a real DB. Unit tests would require more mocks and can miss integration issues. We did not add full UI E2E or live Stripe/M-Pesa in CI to avoid flakiness and secrets; we accept that coverage is “critical path + operations” rather than exhaustive.

**Consequences (positive & negative):** Positive: fast feedback on deploy-breaking changes, simple test DB story. Negative: some regressions in untested code paths may slip through; we rely on code review and diagnostics for production issues.

---

These decisions reflect the current LedgerX implementation and deployment. When we change them, we will update this document and, where appropriate, ARCHITECTURE.md and README.md.
