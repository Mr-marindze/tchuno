# Tchuno Codex Operating Manual

This file is the permanent operating manual for Codex/development agents working
in this repository. It is normative for agent behavior, but it does not replace
the product, architecture, security, or domain documentation.

Tchuno is an existing Mozambican services marketplace. Do not restart it from
scratch, do not silently redesign it, and do not treat aspirational ideas as
implemented reality.

## 1. Read First

Before making non-trivial changes, read the relevant current sources:

- [README.md](README.md)
- [docs/README.md](docs/README.md)
- [docs/current-status.md](docs/current-status.md)
- [docs/product-vision.md](docs/product-vision.md)
- [docs/project-context.md](docs/project-context.md)
- [docs/personas.md](docs/personas.md)
- [docs/domain-model.md](docs/domain-model.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/security-model.md](docs/security-model.md)
- [docs/roadmap.md](docs/roadmap.md)
- [BACKLOG.md](BACKLOG.md)
- [docs/decisions/](docs/decisions/)

For specialized work, also read the relevant specialist document:

- product flow: [docs/PRODUCT_FLOW.md](docs/PRODUCT_FLOW.md)
- service requests: [docs/SERVICE_REQUESTS_FLOW.md](docs/SERVICE_REQUESTS_FLOW.md)
- payments: [docs/PAYMENTS_FOUNDATION.md](docs/PAYMENTS_FOUNDATION.md),
  [docs/PAYMENTS_FLOW.md](docs/PAYMENTS_FLOW.md), and
  [docs/PAYMENTS_SECURITY.md](docs/PAYMENTS_SECURITY.md)
- access/security: [docs/ACCESS_PHASE2_SECURITY.md](docs/ACCESS_PHASE2_SECURITY.md)
- categories: [docs/CATEGORIES_MVP_CATALOG.md](docs/CATEGORIES_MVP_CATALOG.md)
- pilot/ops: [docs/PILOT_CHECKLIST.md](docs/PILOT_CHECKLIST.md) and
  [docs/PILOT_RUNBOOK.md](docs/PILOT_RUNBOOK.md)

Also inspect the actual implementation when it matters:

- root [package.json](package.json)
- workspace package files in `apps/*/package.json` and `packages/*/package.json`
- Prisma schema at `packages/database/prisma/schema.prisma`
- migrations under `packages/database/prisma/migrations/`
- env examples: `.env.example`, `.env.staging.example`
- CI: `.github/workflows/ci.yml`

## 2. Source Hierarchy

When sources conflict, resolve them in this order:

1. Current code and database schema: what the system actually does.
2. Accepted ADRs: durable decisions that must not be silently reversed.
3. Specialized documentation: product flow, service requests, payments,
   security, categories, pilot docs.
4. General documentation: architecture, domain model, product vision, current
   status, roadmap.
5. The specific task prompt: what is authorized in the current execution.

A task prompt can authorize work, but it must not silently destroy a structural
decision. If a task conflicts with accepted ADRs or consolidated documentation,
report:

```text
DECISION REQUIRED
```

Explain the conflict, alternatives, impact, and any safe independent work.

## 3. Human Decisions Vs Agent Work

Humans decide:

- product vision and roadmap;
- priorities and business rules;
- structural architecture changes;
- monetization and payment strategy;
- main user experience;
- trust/safety policy;
- strategic integrations;
- breaking changes.

Codex/agents may:

- implement authorized changes;
- run tests and validation;
- create authorized migrations;
- update corresponding documentation;
- perform technical analysis;
- recommend decisions.

Do not turn recommendations into approved decisions without explicit approval.

## 4. Decision Required Rule

Use `DECISION REQUIRED` before choosing arbitrarily when work would:

- alter the core marketplace flow;
- change the payment model or ledger behavior;
- introduce a new role or permission model;
- modify ownership rules;
- change location/privacy strategy;
- add a live external provider or strategic integration;
- change review/reputation policy;
- change category taxonomy fundamentals;
- introduce structural infrastructure such as Redis, queues, event brokers,
  microservices, GraphQL, Kubernetes, another database, or another ORM;
- break API, schema, URL, status, role, auth, or env compatibility.

Implement only independent safe parts, if any, and wait for a decision on the
blocked part.

## 5. Core Product Invariants

The official marketplace flow is request-first:

```text
ServiceRequest -> Proposal -> Selection -> Job
```

The current financial/execution extension is:

```text
Job -> PaymentIntent -> payment/contact unlock -> execution -> Review
```

Do not reintroduce direct `Job` creation as the main product flow. Legacy direct
job endpoints blocked with `410 Gone` must not be reactivated without explicit
decision.

Categories follow the accepted rule:

```text
controlled categories + flexible request description
```

Do not create categories automatically from free text. Significant taxonomy
changes require product analysis.

Reviews must be tied to eligible/completed jobs according to current rules. Do
not create arbitrary public reviews detached from marketplace work.

Location follows:

```text
approximate location before precise public location
```

Do not expose precise addresses or coordinates publicly for convenience. Apply
data minimization, least exposure, and purpose limitation.

Payments are a real domain boundary. Payment state and split computation are
server-side. Ledger entries are append-only. External payment gateways are
currently simulated/prepared, not production-live integrations.

## 6. Out Of Scope Domain

MozScam/Moses Cam is not part of Tchuno.

Do not introduce:

- scam-number databases;
- mobile money number reports;
- scam scoring;
- phone blacklists;
- MozScam-specific antifraud architecture.

Tchuno trust/safety is marketplace safety, not MozScam.

## 7. Mozambican Context

Consider the local context:

- informal economy;
- uneven connectivity;
- mobile data cost sensitivity;
- provider diversity;
- varied digital literacy;
- users without modern smartphones.

Do not assume USSD, SMS, WhatsApp, or a specific mobile money integration is
approved. Those require separate decisions.

## 8. Architecture Rules

Preserve the current architecture unless explicitly authorized:

```text
Next.js Web -> REST -> NestJS API -> Prisma -> PostgreSQL
```

Do not silently introduce:

- another ORM or database;
- GraphQL;
- microservices;
- Redis, queues, or event brokers;
- Kubernetes;
- a new auth provider;
- a new storage provider.

These are not forbidden forever; they require explicit architectural decision.

## 9. Backend Rules

For backend changes:

- validate input through DTOs and the existing validation style;
- keep complex business rules in services, not controllers;
- preserve ownership checks;
- protect sensitive endpoints with auth and authorization;
- consider transactions for critical multi-entity operations;
- keep public errors from leaking internals;
- preserve state transition rules;
- never trust `userId`, role, price, payment status, or ownership sent by the
  frontend when the server can derive it.

Use backend tests for negative cases when relevant:

- unauthenticated;
- forbidden;
- wrong owner;
- invalid state;
- duplicate operation;
- replay/idempotency.

## 10. Frontend Rules

Frontend is not the security authority.

- Client-side route guards are UX helpers only.
- Backend authorization must enforce access.
- Do not simulate core features with `localStorage`.
- Do not present mocks as production.
- Do not hide missing backend behavior behind UI.
- Do not rely on disabled buttons for business rules.

If a visible feature lacks real persistence/backend integration, classify it as
`UI_ONLY` in documentation or reports.

## 11. Database And Prisma Policy

Before changing schema:

1. Read `packages/database/prisma/schema.prisma`.
2. Inspect existing migrations.
3. Identify impact on existing data.
4. Check and update seed/catalog scripts when needed.
5. Create explicit migrations when needed.
6. Do not edit already-applied migrations to rewrite history.
7. Do not use `db push` as a silent substitute for migrations in shared
   environments.
8. Validate indexes, constraints, nullable fields, and cascades.
9. Document relevant domain/status/readiness changes.

Never delete data, reset DBs, or run destructive migrations without explicit
approval.

For potentially destructive migrations, report:

```text
MIGRATION RISK
```

Explain affected data, rollback possibility, backfill strategy, compatibility,
and downtime risk. Prefer backward-compatible migrations.

## 12. Security Policy

Security is a requirement, not an optional phase.

Preserve:

- JWT access tokens;
- refresh sessions and httpOnly cookies;
- bcrypt password hashing;
- RBAC, permissions, ownership checks, and admin subroles;
- reauthentication for critical actions;
- validation and throttling;
- persistent audit logs.

Apply deny-by-default to sensitive operations.

Never:

- hardcode real secrets;
- log passwords, tokens, or unnecessary PII;
- trust frontend-supplied roles;
- remove guards just to make a flow work;
- disable validation to pass tests;
- bypass ledger for financial movements;
- trust payment success supplied only by the client;
- accept external callbacks without appropriate verification.

## 13. Environment And Secrets

`.env.example` files may contain obvious placeholders. Real secrets must never
be committed.

Do not introduce insecure defaults such as `change-me`, `secret`, `password`, or
`123456` for real environments. Non-dev environments must not silently accept
development secrets.

## 14. Uploads

Uploads are a security surface. Future upload work must consider:

- MIME allowlist;
- extension checks;
- size limits;
- safe names;
- storage isolation;
- authorization;
- presigned URL expiry;
- malware scanning where applicable.

A presigned URL alone is not a complete upload security policy.

## 15. Test And Validation Policy

Use real scripts from `package.json`; do not invent commands.

Current root scripts include:

- `yarn lint`
- `yarn test`
- `yarn test:e2e`
- `yarn test:smoke:web`
- `yarn ci`
- `yarn workspace @tchuno/api build`
- `yarn workspace @tchuno/web build`
- `yarn workspace @tchuno/database prisma validate`
- `yarn workspace @tchuno/database generate`

Minimum validation by change type:

- documentation only: `git diff --check`;
- backend: relevant lint/test/build;
- database/schema: Prisma validate/generate plus relevant tests;
- core flow: API E2E is required;
- frontend: lint/build/smoke as impact requires;
- auth/security/payments: include negative tests where relevant.

Report validation as:

```text
command -> PASS
command -> FAIL - reason
command -> BLOCKED - reason
command -> NOT RUN - reason
```

Never declare `PASS` for a command that was not run.

Do not change tests simply to make them green. First decide whether the
requirement changed, the test is outdated, or the implementation is wrong. A
business expectation change may require `DECISION REQUIRED`.

## 16. Refactor And Compatibility Policy

Finding technical debt does not authorize refactoring.

Refactors must be in scope, small, justified, behavior-preserving unless
explicitly authorized, and covered by appropriate validation.

Avoid "while I am here" changes.

Preserve compatibility where reasonable. Breaking changes in API, schema, URLs,
roles, auth, status values, envs, or operational scripts must be reported as:

```text
BREAKING CHANGE
```

Include migration path and impact.

## 17. Legacy Code

Do not delete legacy code just because it looks unused. First determine why it
exists, whether consumers remain, whether docs reference it, and whether removal
is safe.

Do not reactivate legacy flows just to simplify implementation.

## 18. Documentation Policy

Relevant changes must update corresponding documentation:

- domain changes -> [docs/domain-model.md](docs/domain-model.md)
- architecture changes -> [docs/architecture.md](docs/architecture.md) and
  possibly an ADR
- readiness/status changes -> [docs/current-status.md](docs/current-status.md)
- core flow changes -> product flow docs and an ADR
- security changes -> [docs/security-model.md](docs/security-model.md)
- payment changes -> payment docs

Do not update `docs/current-status.md` with unvalidated claims.

Create ADRs only for durable structural decisions. Do not create ADRs for typos,
small fixes, or local refactors. If replacing a decision, create a new ADR and
mark the relationship instead of rewriting history.

## 19. Git Safety

Before substantial work, inspect:

```bash
git status --short
git branch --show-current
git rev-parse --short HEAD
```

Do not overwrite local changes that are unrelated to the task.

Do not run destructive Git operations by default:

- `git reset --hard`;
- `git clean`;
- destructive rebase;
- force push;
- branch deletion;
- history rewriting.

Do not commit, tag, or push unless the prompt explicitly authorizes it. Tags
represent approved milestones, not every Codex execution.

## 20. Scope Discipline

Every execution must distinguish:

- `IN SCOPE`: authorized work;
- `OUT OF SCOPE`: everything else.

If you find a problem outside scope, do not fix it automatically. Report:

```text
OUT-OF-SCOPE FINDING
```

## 21. No Silent Assumptions

Do not silently assume requirements, business rules, providers, pricing, roles,
policies, or infrastructure.

Do not call something complete just because it has a page, button, endpoint, or
mock. Distinguish UI, backend, integration, tests, and production readiness.

Use current status labels consistently:

```text
NOT_IMPLEMENTED
UI_ONLY
BACKEND_ONLY
PARTIAL
SIMULATED
IMPLEMENTED
IMPLEMENTED_AND_TESTED
```

## 22. Reporting Standard

For each relevant execution, report:

```text
Summary
Scope
Files Changed
Database Changes
Security Impact
Tests & Validation
Decisions Required
Out-of-Scope Findings
Known Limitations
Git Status
Recommendation
```

Use `none`, `none identified`, `NOT RUN`, or `BLOCKED` explicitly where
appropriate.

## 23. Definition Of Done

A task is not done merely because code was written.

It is done when, as applicable:

- implementation matches authorized scope;
- tests and validation are appropriate and reported;
- security impact was considered;
- migrations/seeds are correct;
- documentation was updated;
- no known regression is hidden;
- pending decisions are explicit;
- the final report is clear.
