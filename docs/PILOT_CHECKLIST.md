# Pilot Operational Gate Checklist

This checklist is the executable gate for a controlled Tchuno pilot. It does
not approve production launch.

Use `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` for each item during a pilot gate
review.

## 1. Pre-Deploy

- [ ] Branch is `main`.
- [ ] Commit under review is the approved pilot candidate.
- [ ] GitHub Actions is green for:
  - `lint-and-test`
  - `coverage`
  - `e2e`
  - `smoke-web`
  - `integration-web-api`
  - `docker-build`
- [ ] `.yarn/install-state.gz` or other local-only files are not part of the
  release candidate.
- [ ] `.env.staging` or pilot env file is created from `.env.staging.example`.
- [ ] `NODE_ENV` is `staging` or `pilot` for the pilot runtime.
- [ ] `DATABASE_URL`, JWT secrets, webhook secrets, and `WEB_ORIGIN` are
  configured with non-placeholder values.
- [ ] Database endpoint is reachable from the API host.
- [ ] Storage envs are configured if attachment uploads are enabled for the
  pilot.
- [ ] Payment mode is explicitly set to `PAYMENT_DEFAULT_PROVIDER=INTERNAL`
  unless a separate approved decision changes it.
- [ ] Admin user exists and can authenticate.
- [ ] Backup directory is outside Git tracking.

## 2. Startup

- [ ] Validate compose config:
  `docker compose -f docker-compose.yml config`.
- [ ] For staging DB only, validate:
  `docker compose --env-file .env.staging -f docker-compose.staging.yml config`.
- [ ] Start PostgreSQL.
- [ ] Run migrations:
  `corepack yarn workspace @tchuno/database prisma migrate deploy`.
- [ ] Run seed only where demo/pilot baseline data is intended:
  `corepack yarn workspace @tchuno/database prisma db seed`.
- [ ] Start API.
- [ ] Start Web.
- [ ] `GET /observability/health` returns `200`.
- [ ] `GET /observability/ready` returns `200` and database check `ok`.
- [ ] `GET /observability/metrics` returns Prometheus text.
- [ ] Swagger is reachable at `/docs`.

## 3. Functional Smoke

- [ ] Customer can log in.
- [ ] Provider can log in.
- [ ] Admin can log in.
- [ ] Customer creates a `ServiceRequest`.
- [ ] Provider submits a `Proposal`.
- [ ] Customer selects one proposal.
- [ ] Backend creates `Job` from `ServiceRequest -> Proposal -> Selection`.
- [ ] `POST /jobs` direct creation remains blocked with `410 Gone`.
- [ ] Payment intent is created after selection.
- [ ] Payment simulation succeeds using the configured pilot provider.
- [ ] Contact unlock happens only after backend-confirmed payment state.
- [ ] Customer and provider can access job conversation after unlock.
- [ ] Message send works.
- [ ] Attachment presign/upload path is tested when storage is configured.
- [ ] Review is created only after a completed job, if the UI path is included
  in the pilot script.

## 4. Pilot Payment Mode

- [ ] Operator confirms `PAYMENT_DEFAULT_PROVIDER=INTERNAL` for the controlled
  pilot, or records a separate approved decision.
- [ ] UI and documentation do not present M-Pesa/e-Mola as live integrations.
- [ ] Payment success is triggered only through backend payment endpoints or
  admin/reconciliation flows.
- [ ] Admin can identify `PaymentIntent`, transactions, and ledger entries.
- [ ] Expected paid deposit status is `PAID_PARTIAL`.
- [ ] Failed or pending payment behavior is documented for the selected
  provider.

## 5. Pilot Users And Providers

- [ ] Pilot customers are created through registration, seed, or controlled
  admin/support process.
- [ ] Pilot providers have a `User` plus `WorkerProfile`.
- [ ] Provider availability is checked before inviting/using the provider in
  pilot scenarios.
- [ ] Providers are known to the pilot team.
- [ ] UI copy does not claim identity/KYC verification.
- [ ] Password recovery path is operationally understood.

## 6. Operational

- [ ] Logs include `requestId`, route, status, duration, and user id where
  applicable.
- [ ] Operators can inspect metrics for 5xx spikes and failing routes.
- [ ] Backup completed with `corepack yarn ops:backup:postgres`.
- [ ] Restore test completed into an isolated database/schema.
- [ ] Incident owner and escalation contact are recorded.
- [ ] Rollback target commit/image is recorded before pilot start.
- [ ] Support knows how to record operational incidents.
- [ ] Trust/safety interventions can be reviewed by authorized admins.

## 7. Security

- [ ] Default or placeholder secrets are refused in `staging`, `pilot`, and
  `production`.
- [ ] Admin-only routes reject customer/provider access.
- [ ] Critical admin actions require reauth.
- [ ] Audit log captures critical admin operations.
- [ ] Upload presign policy enforces ownership, contact unlock, MIME, size,
  expiry, and server-generated keys.
- [ ] Logs do not expose passwords, JWTs, refresh tokens, raw auth headers,
  storage secrets, or webhook secrets.
- [ ] No live-payment claim appears for simulated/internal payment operation.

## 8. Go / No-Go

Pilot may be `GO` only if every mandatory startup, smoke, backup/restore,
payment, security, and observability item is green or has an explicit accepted
mitigation.

Production remains `NO-GO`.
