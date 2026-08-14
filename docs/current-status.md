# Current Status

This document is the current concise status baseline for Tchuno. It is based on
repository inspection at commit `94e5bb1` on branch `main`, plus V1.2 security
and integration hardening changes in the working tree.

V1.1 foundation hardening updates the baseline with demo seed compatibility,
application Dockerfiles, local compose runtime, stricter non-development
environment validation, and database-backed readiness checks. It does not make
the project production-ready.

V1.2 hardens backend message attachment upload policy and adds a real
browser-to-API-to-PostgreSQL integration test for the core marketplace path.

## Git Baseline

- Branch audited: `main`
- Commit audited: `94e5bb1`
- Latest tag observed: `v0.4.0-mvp-release`
- Pre-documentation working tree at audit time: modified
  `.yarn/install-state.gz` only; exclude it from the documentation baseline.

## General State

Tchuno is currently:

**Advanced functional MVP / pilot-ready with conditions**

It is not production-ready.

The core product flow is implemented:

`ServiceRequest -> Proposal -> Selection -> Job`

The current implementation extends this operationally:

`ServiceRequest -> Proposal -> Selection -> Job -> PaymentIntent -> payment/contact unlock -> execution -> Review`

The old direct job creation flow is blocked and should not be treated as a
supported product path.

## Maturity Estimate

- product core: 75-85%
- frontend: 70-80%
- backend: 80-90%
- database: 75-85%
- auth/security: 70-80%
- testing: 75-85%
- operations: 35-50%
- documentation: 65-75%
- production readiness: 35-45%

These are broad ranges, not precise measurements.

## Feature Status

| Feature | Status | Notes |
| --- | --- | --- |
| Landing | IMPLEMENTED_AND_TESTED | Covered by web smoke. |
| Categories | IMPLEMENTED_AND_TESTED | Public list and admin management exist. |
| Public provider listing | IMPLEMENTED_AND_TESTED | `/prestadores` uses real API. |
| Public provider profile | IMPLEMENTED_AND_TESTED | `/prestadores/[slug]` and reviews exist. |
| Authentication | IMPLEMENTED_AND_TESTED | Register, login, refresh, sessions, logout. |
| Customer registration | IMPLEMENTED_AND_TESTED | Creates `User`. |
| Provider onboarding/KYC | PARTIAL | Worker profile exists; no formal KYC. |
| Customer dashboard | IMPLEMENTED_AND_TESTED | `/app/*` routes. |
| Provider dashboard | IMPLEMENTED_AND_TESTED | `/pro/*` routes. |
| Admin completeness | PARTIAL | Strong ops/payment/audit surfaces; not full platform console. |
| Service requests | IMPLEMENTED_AND_TESTED | Request creation/list/detail/update/recreate. |
| Invitations | IMPLEMENTED | Request invitations exist and are used. |
| Proposals | IMPLEMENTED_AND_TESTED | Provider proposals and customer review/selection. |
| Selection | IMPLEMENTED_AND_TESTED | Creates job and payment intent transactionally. |
| Jobs | IMPLEMENTED_AND_TESTED | Official flow enforced; legacy direct flow blocked. |
| Reviews | IMPLEMENTED_AND_TESTED | Requires completed job. |
| Notifications | IMPLEMENTED | In-app notification model and UI usage exist. |
| Expiration | IMPLEMENTED_AND_TESTED | Requests and invitations expire. |
| Matching | PARTIAL | Simple deterministic/provider inbox logic, not advanced matching. |
| Proximity | PARTIAL | Text location and service areas; no geospatial matching. |
| Search/filter depth | PARTIAL | Basic search and filters exist. |
| Location | PARTIAL | Approximate text fields, no GPS capability. |
| S3 upload flow | BACKEND_ONLY | Presign has backend auth, ownership, state, MIME, size, expiry, and server-generated key policy. No frontend upload UI yet. |
| External payment gateways | SIMULATED | Internal/simulated adapters exist; live providers deferred. |
| Analytics/tracking | IMPLEMENTED_AND_TESTED | Event ingestion and aggregates exist. |
| Audit | IMPLEMENTED_AND_TESTED | Audit logs and reauth covered by tests. |

## Validation Baseline

Observed validation results during repository audit:

- `yarn install --immutable`: PASS with peer dependency warning for `webpack`
  requested by `ts-loader`.
- `yarn lint`: PASS.
- `yarn test`: PASS.
- `yarn workspace @tchuno/database prisma validate`: PASS.
- `yarn workspace @tchuno/api build`: PASS.
- `yarn workspace @tchuno/web build`: PASS.
- `yarn test:e2e`: PASS with local PostgreSQL available.
- `yarn test:smoke:web`: PASS.
- Docker compose config checks for dev and staging DB: PASS.

Additional V1.1 validation target:

- demo seed repeatability on migrated schema: PASS.
- API Docker image build: PASS.
- Web Docker image build: PASS.
- local compose config with DB/API/Web/bootstrap services: PASS.
- API readiness endpoint with database query: PASS.

Additional V1.2 validation target:

- API upload policy positive and negative tests: covered by API e2e.
- Real browser-to-API-to-PostgreSQL marketplace integration: covered by
  `yarn test:integration:web-api` and CI job `integration-web-api`.

## Production Readiness

- Local development: GO.
- Demo: GO WITH CONDITIONS.
- Staging: GO WITH CONDITIONS.
- Pilot: GO WITH CONDITIONS.
- Production: NO-GO.

## Known Gaps

1. External payment gateways are simulated/prepared, not live integrations.
2. Upload malware/content scanning is not implemented.
3. Email verification is not implemented.
4. Phone verification is not implemented.
5. Self-service password reset is not implemented.
6. Proximity/geodata is partial.
7. Provider role model is derived from `WorkerProfile`, which may need a
    future explicit model.
8. Frontend integration against the real API exists for the core
    request/proposal/selection/payment path; provider execution transitions and
    review are still not exposed as a complete browser flow.
9. Backup strategy is not implemented in repo.
10. External observability and alerting are not implemented in repo.
11. Security scanning is not configured in CI.
12. Deploy/release automation is not implemented.
13. CI does not build Docker images.
14. The Docker runtime is suitable for local/pilot validation, not a complete
    production platform.

## Documentation Baseline

Documentation has been consolidated around:

- product vision and context;
- architecture;
- domain model;
- security model;
- current status;
- roadmap;
- ADRs for major product/architecture decisions.

Specialized documents remain the source for detailed flows, payments,
operations, pilot, and runbooks.
