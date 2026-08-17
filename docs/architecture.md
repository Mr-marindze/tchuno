# Architecture

This document describes the architecture that exists in the repository today.

## Runtime Shape

```text
Browser
   |
Next.js Web
   |
REST API
   |
NestJS
   |
Prisma
   |
PostgreSQL
```

## Applications

### Web

Path: `apps/web`

Responsibilities:

- public pages;
- customer area under `/app`;
- provider area under `/pro`;
- admin area under `/admin`;
- route guards and role-based navigation;
- API client helpers in `apps/web/src/lib`.

Framework:

- Next.js App Router;
- React;
- Tailwind CSS.

### API

Path: `apps/api`

Responsibilities:

- REST API;
- authentication and sessions;
- authorization and reauth;
- service requests, invitations, proposals, jobs, reviews;
- payments, refunds, payouts, ledger, and reconciliation;
- notifications, messages, trust/safety, support, admin, tracking;
- health and Prometheus metrics.

Framework:

- NestJS;
- Prisma client;
- Swagger at `/docs`.

### Database Package

Path: `packages/database`

Responsibilities:

- Prisma schema;
- migrations;
- seed and operational scripts;
- official category catalog sync.

Database:

- PostgreSQL.

## Important Modules

- `auth`: JWT, refresh sessions, cookies, RBAC, permissions, reauth, audit.
- `service-requests`: request-first marketplace flow.
- `jobs`: job execution and legacy direct job blocking.
- `payments`: payment intents, transactions, ledger, refunds, payouts.
- `messages`: job conversations and hardened backend upload presign flow for
  message attachments.
- `trust-safety`: contact-sharing risk detection and interventions.
- `support-ops`: operational incident management.
- `tracking`: event ingestion and worker/category aggregates.
- `observability`: health and metrics endpoints.

## Authentication And Authorization

The backend is the source of truth for access control.

- access JWT is sent as Bearer token;
- refresh token is persisted as a hashed session and issued in httpOnly cookie;
- app roles and permissions are resolved server-side;
- admin-critical routes can require one-use reauth token;
- frontend route guards improve UX but do not replace backend guards.

See [security-model.md](security-model.md).

## Payments Boundary

Payments are a separate domain boundary from jobs. The job lifecycle and payment
lifecycle are connected but not the same.

Current state:

- backend computes payment splits;
- ledger entries record financial movements;
- internal and simulated external gateways exist;
- live M-Pesa/e-Mola production gateway integration is not complete.

## Observability

Current observability includes:

- `GET /observability/health`;
- `GET /observability/ready`, including a database readiness query;
- `GET /observability/metrics`;
- structured request logging;
- business metrics for auth, jobs, reviews, payments, and related flows.

The API does not eagerly connect Prisma during module initialization. Database
availability is checked through readiness and through routes that need the
database, allowing liveness and readiness to remain separate operational
signals.

External monitoring, alerting, and production dashboards are not implemented in
this repository.

## Infrastructure

Current infrastructure files:

- `apps/api/Dockerfile`: API application image with Prisma/OpenSSL runtime
  support and readiness healthcheck.
- `apps/web/Dockerfile`: Web application image with Next.js production start
  and HTTP healthcheck.
- `docker-compose.yml`: local PostgreSQL, migration/seed bootstrap, API, and
  Web stack.
- `docker-compose.staging.yml`: staging PostgreSQL database.
- `.github/workflows/ci.yml`: lint/unit, coverage, API e2e, mocked web smoke,
  real Web/API/PostgreSQL integration, and Docker image build jobs.
- `scripts/ops/postgres-backup.sh` and `scripts/ops/postgres-restore.sh`:
  manual PostgreSQL backup/restore helpers for pilot operations.

Current limitations:

- no complete production deployment platform or release pipeline;
- no Redis or queue worker;
- no reverse proxy config;
- no production-grade automated backup platform;
- no deploy pipeline.

## Timers And Background Work

There is no separate queue worker process today.

Examples of background-like behavior live inside the API process:

- stale service request expiration;
- automatic payment reconciliation runner.

This is acceptable for MVP/pilot conditions but should be revisited before
production.

## Storage

S3 presigned uploads are prepared for message attachments and currently exposed
only through the API.

Current policy:

- storage depends on environment configuration;
- presign requests are authenticated and bound to an existing job participant;
- uploads require contact unlock/payment eligibility;
- canceled jobs cannot receive new upload presigns;
- object keys are generated server-side under
  `uploads/messages/{userId}/{jobId}/{uuid}.{ext}`;
- allowed content types are JPEG, PNG, and WebP;
- declared size is limited to 5 MiB;
- presigned expiry is bounded between 60 and 600 seconds;
- persisted message attachments must reference keys bound to the same user and
  job.

Current limitations:

- the frontend does not expose attachment uploads yet;
- malware/content scanning is not implemented;
- CI builds Docker images but does not publish or scan them.

## Integration Testing

CI includes a real browser-to-API integration job:

- creates an isolated PostgreSQL schema;
- runs Prisma migrations and seed;
- builds API and Web;
- starts NestJS API and Next.js Web;
- drives Playwright through login, request creation, provider proposal,
  proposal selection, internal payment simulation, and contact unlock;
- verifies the resulting job and `PAID_PARTIAL` payment intent through the API;
- drops the temporary schema after the run.

The existing web smoke test remains mocked and focused on frontend screen
coverage.
