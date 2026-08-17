# Pilot Runbook

This runbook describes how to operate a small controlled Tchuno pilot. It is
for local, demo, staging, and pilot-like environments. It is not a production
runbook.

## 1. Runtime Modes

### Local Docker Runtime

Use this when validating the full local application stack:

```bash
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml up --build
```

The local compose file starts PostgreSQL, runs migrations and seed through
`db-bootstrap`, then starts API and Web.

Local compose secrets are development-only and must not be copied to staging,
pilot, or production.

### Staging/Pilot Manual Runtime

The current staging compose file starts PostgreSQL only. API and Web are
started by scripts from the checked-out codebase:

```bash
corepack yarn staging:db:up
corepack yarn staging:bootstrap
corepack yarn staging:api
corepack yarn staging:web
corepack yarn staging:check
```

Because `docker-compose.staging.yml` does not run API and Web containers,
staging is `GO WITH CONDITIONS` until a complete deploy/runtime definition
exists.

## 2. Environment

Create `.env.staging` from `.env.staging.example`.

Required pilot/staging values:

- `NODE_ENV=staging` or `NODE_ENV=pilot`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `WEB_ORIGIN`
- `NEXT_PUBLIC_API_URL`
- `PAYMENT_DEFAULT_PROVIDER=INTERNAL`
- `PAYMENT_WEBHOOK_SECRET`
- `PAYMENT_WEBHOOK_SECRET_MPESA`
- `PAYMENT_WEBHOOK_SECRET_EMOLA`

For `staging`, `pilot`, and `production`, placeholder and short sensitive
values are refused at API startup.

## 3. Start

1. Confirm branch and commit.
2. Confirm CI is green.
3. Confirm `.env.staging` or pilot env file is populated.
4. Start DB.
5. Run migrations:
   `corepack yarn workspace @tchuno/database prisma migrate deploy`.
6. Run seed when using demo/pilot baseline accounts:
   `corepack yarn workspace @tchuno/database prisma db seed`.
7. Start API.
8. Start Web.
9. Run `corepack yarn staging:check` or equivalent endpoint checks.

## 4. Stop

For local compose:

```bash
docker compose -f docker-compose.yml down
```

For staging DB:

```bash
corepack yarn staging:db:down
```

Do not use `down -v` unless intentionally deleting the database volume after a
backup and approval.

Stop manually started API/Web processes with `Ctrl+C` or the supervisor used by
the pilot environment.

## 5. Validate

API:

- `GET /observability/health` confirms the API process is alive.
- `GET /observability/ready` confirms API readiness and database access.
- `GET /observability/metrics` exposes Prometheus metrics.
- `GET /docs` exposes Swagger.

Web:

- Open `/`.
- Open customer `/app/pedidos`.
- Open provider `/pro/pedidos`.
- Open admin `/admin`.

Core pilot flow:

1. Customer logs in.
2. Customer creates a service request.
3. Provider logs in.
4. Provider submits proposal.
5. Customer selects proposal.
6. Backend creates job and payment intent.
7. Customer pays simulated deposit.
8. Contact unlock appears.
9. Customer/provider exchange message.
10. Attachment flow is tested only when storage is configured.

## 6. Pilot Payment Mode

Live providers are outside V1.

The controlled pilot payment mode is:

```text
SIMULATED / INTERNAL / MANUAL PILOT PAYMENT MODE
```

Default setting:

```bash
PAYMENT_DEFAULT_PROVIDER=INTERNAL
```

Behavior:

- selection creates a deposit `PaymentIntent`;
- `POST /payments/intents/:id/pay` simulates payment through the configured
  backend gateway;
- successful internal deposit transitions the intent to `PAID_PARTIAL`;
- contact unlock is based on backend payment state, not a client claim;
- admin can inspect intents, transactions, refunds, payouts, and ledger
  entries in the admin payments surface.

`MPESA` and `EMOLA` adapters are simulated external adapters. They must not be
described as live integrations during the pilot.

## 7. Pilot Users And Providers

Seeded demo accounts:

- `admin@tchuno.local` / `demo1234`
- `client1@tchuno.local` / `demo1234`
- `client2@tchuno.local` / `demo1234`
- `worker1@tchuno.local` / `demo1234`
- `worker2@tchuno.local` / `demo1234`

Customer pilot process:

1. Create account through registration or seed.
2. Confirm login.
3. Use assisted password recovery/admin support if access is lost.

Provider pilot process:

1. Create a user account.
2. Create or update `WorkerProfile`.
3. Assign controlled categories.
4. Set availability and service areas.
5. Use only known pilot providers.

Tchuno does not currently implement formal KYC. UI and operator language must
not claim that providers are identity verified.

## 8. Diagnose

API unavailable:

- check API process logs;
- check `API_PORT`;
- check `WEB_ORIGIN`;
- call `/observability/health`.

Database unavailable:

- call `/observability/ready`;
- check PostgreSQL container/service;
- verify `DATABASE_URL`;
- run `pg_isready` from the API host where possible.

Request/proposal/job issue:

- capture `x-request-id`;
- inspect structured logs by `requestId`;
- check service request status, proposal status, job status, and ownership.

Payment simulation issue:

- confirm `PAYMENT_DEFAULT_PROVIDER`;
- inspect `PaymentIntent`, `PaymentTransaction`, and ledger entries;
- run admin pending reconciliation only for simulated external providers.

Upload issue:

- confirm storage envs;
- confirm job participant ownership;
- confirm contact unlock;
- confirm MIME, file extension, size, and expiry policy.

## 9. Recover

Restart:

1. Stop API/Web.
2. Confirm DB is healthy.
3. Start API.
4. Start Web.
5. Re-run health/readiness and smoke checks.

Stuck operation:

1. Record an operational incident.
2. Preserve request ids and affected entity ids.
3. Use admin/support surfaces where available.
4. Avoid direct DB mutation unless reviewed and documented.

Restore:

- follow [Backup and restore runbook](BACKUP_RESTORE_RUNBOOK.md);
- restore only into the intended target;
- validate user, request, proposal, and job counts after restore.

## 10. Rollback

Application rollback:

1. Identify last known-good commit/image.
2. Stop current API/Web.
3. Deploy or checkout last known-good application code/image.
4. Keep the database at the current migrated state unless a reviewed database
   recovery plan is approved.
5. Run health/readiness and pilot smoke.

Database rollback:

- migrations are treated as forward-only by default;
- do not promise automatic destructive migration rollback;
- restore from backup into a clean target if data rollback is required;
- reconcile application code with the restored schema before reopening pilot
  access.

## 11. Incident Handling

Minimum incident lifecycle:

```text
Detect -> Record -> Classify -> Mitigate -> Resolve -> Review
```

Classify at least:

- application;
- database;
- payment;
- security;
- abuse/trust-safety;
- availability.

Use existing `OperationalIncident`, support ops, trust/safety, audit logs, and
payment admin surfaces. Do not create a parallel tracker unless the repository
system is unavailable.

## 12. Operational Roles

Super/Admin:

- environment configuration;
- critical user/admin changes;
- audit review;
- final gate decision.

Ops:

- incidents;
- stuck jobs/payments;
- readiness and metrics;
- backup/restore execution.

Support:

- user access issues;
- pilot participant communication;
- basic disputes;
- incident intake.

Finance/Admin:

- payment intent review;
- refunds;
- payouts;
- reconciliation.

No new RBAC model is required for the pilot.
