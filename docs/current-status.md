# Current Status

This document is the current concise status baseline for Tchuno. It is based on
repository inspection at commit `99c98fa` on branch `main`.

## Git Baseline

- Branch audited: `main`
- Commit audited: `99c98fa`
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
| S3 upload flow | BACKEND_ONLY | Presign is prepared; production validation incomplete. |
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

## Production Readiness

- Local development: GO.
- Demo: GO WITH CONDITIONS.
- Staging: GO WITH CONDITIONS.
- Pilot: GO WITH CONDITIONS.
- Production: NO-GO.

## Known Gaps

1. `packages/database/prisma/seed.ts` is probably incompatible with required
   `ServiceRequest.expiresAt`.
2. Root `Dockerfile` is a placeholder and does not build the application.
3. External payment gateways are simulated/prepared, not live integrations.
4. Environment secret fallback hardening is required before production.
5. Upload validation and storage hardening are incomplete.
6. Email verification is not implemented.
7. Phone verification is not implemented.
8. Self-service password reset is not implemented.
9. Proximity/geodata is partial.
10. Provider role model is derived from `WorkerProfile`, which may need a
    future explicit model.
11. Frontend integration test against the real API is still missing.
12. Backup strategy is not implemented in repo.
13. External observability and alerting are not implemented in repo.
14. Security scanning is not configured in CI.
15. Deploy/release automation is not implemented.

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
