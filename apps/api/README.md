# Tchuno API

This workspace contains the NestJS REST API for Tchuno.

## Responsibilities

- authentication, refresh sessions, cookies, RBAC, permissions, and reauth;
- categories and worker profiles;
- service requests, invitations, proposals, selection, jobs, and reviews;
- payments, refunds, payouts, ledger, webhooks, and reconciliation;
- notifications, job messages, trust/safety, support ops, admin ops;
- tracking, health, metrics, and Swagger documentation.

## Local Commands

From the repository root:

```bash
corepack yarn dev:api
corepack yarn workspace @tchuno/api build
corepack yarn workspace @tchuno/api lint
corepack yarn workspace @tchuno/api test
corepack yarn workspace @tchuno/api test:e2e
```

The API expects PostgreSQL through `DATABASE_URL`.

## Endpoints

- API root: `http://localhost:3001`
- Swagger: `http://localhost:3001/docs`
- Health: `GET /observability/health`
- Readiness: `GET /observability/ready`
- Metrics: `GET /observability/metrics`

## Important Notes

- The official product flow is request-first:
  `ServiceRequest -> Proposal -> Selection -> Job`.
- Direct job creation is deprecated and blocked with `410 Gone`.
- External payment providers are simulated/prepared, not production-live.
- S3 upload presign support is backend-only and includes MIME allowlist, size,
  expiry, ownership, state, and server-generated key policy. Malware/content
  scanning is not implemented.
- Staging, pilot, and production fail fast if required runtime secrets are
  missing or placeholder-like.

See also:

- [API architecture](../../docs/architecture.md)
- [Domain model](../../docs/domain-model.md)
- [Security model](../../docs/security-model.md)
- [Current status](../../docs/current-status.md)
