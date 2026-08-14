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
- `messages`: job conversations and prepared upload presign flow.
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

Current limitations:

- no complete production deployment platform or release pipeline;
- no Redis or queue worker;
- no reverse proxy config;
- no backup automation;
- no deploy pipeline.

## Timers And Background Work

There is no separate queue worker process today.

Examples of background-like behavior live inside the API process:

- stale service request expiration;
- automatic payment reconciliation runner.

This is acceptable for MVP/pilot conditions but should be revisited before
production.

## Storage

S3 presigned uploads are prepared for message attachments.

Current limitation:

- storage depends on environment configuration;
- upload validation and production hardening are partial.
