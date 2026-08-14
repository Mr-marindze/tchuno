# Tchuno

Tchuno is a Mozambican services marketplace. It connects customers who need
services with providers who can submit proposals, execute selected jobs, and
build reputation through completed work.

The product is request-first:

`ServiceRequest -> Proposal -> Selection -> Job`

The current implementation extends this operationally:

`ServiceRequest -> Proposal -> Selection -> Job -> PaymentIntent -> payment/contact unlock -> execution -> Review`

The old direct job creation flow is blocked and should not be reintroduced as
the main product path.

## Current Status

Tchuno is an advanced functional MVP and is pilot-ready with conditions. It is
not production-ready.

Read the current baseline before planning new work:

- [Current status](docs/current-status.md)
- [Roadmap](docs/roadmap.md)
- [Documentation index](docs/README.md)

## Monorepo Structure

```text
apps/
  api/        NestJS REST API
  web/        Next.js web app
packages/
  database/   Prisma schema, migrations, seed, catalog and ops scripts
docs/         Product, architecture, status, security, payments, operations
```

## Architecture

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

More detail:

- [Architecture](docs/architecture.md)
- [Domain model](docs/domain-model.md)
- [Security model](docs/security-model.md)

## Prerequisites

- Node 20
- Corepack enabled (`corepack enable`)
- Docker + Docker Compose

The repository uses Yarn `4.13.0`.

## Local Development

```bash
corepack yarn install
corepack yarn db:up
corepack yarn dev
```

Services:

- API: `http://localhost:3001`
- Web: `http://localhost:3000`
- Swagger: `http://localhost:3001/docs`

Useful local DB commands:

```bash
corepack yarn db:ps
corepack yarn db:logs
corepack yarn db:down
```

## Quality Checks

```bash
corepack yarn lint
corepack yarn test
corepack yarn test:e2e
corepack yarn test:smoke:web
corepack yarn test:integration:web-api
corepack yarn ci
```

E2E and real integration tests require PostgreSQL and `DATABASE_URL`.

## Staging Baseline

1. Create `.env.staging` from `.env.staging.example`.
2. Start the staging database:

```bash
corepack yarn staging:db:up
```

3. Apply migrations and seed demo data:

```bash
corepack yarn staging:bootstrap
```

4. Start API and Web in separate terminals:

```bash
corepack yarn staging:api
corepack yarn staging:web
```

5. Run health checks:

```bash
corepack yarn staging:check
```

The demo seed is expected to be repeatable on a migrated database and includes
request expirations required by the current schema. See
[current status](docs/current-status.md).

## Docker Runtime

V1.1 adds application Docker images for local/pilot validation:

```bash
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml up --build
```

The compose stack starts PostgreSQL, runs migrations and seed through a
`db-bootstrap` service, then starts API and Web. Local compose secrets are for
development only; staging/pilot/production environments must provide real
secrets.

## Key Documentation

Product:

- [Product vision](docs/product-vision.md)
- [Project context](docs/project-context.md)
- [Personas](docs/personas.md)
- [Product flow](docs/PRODUCT_FLOW.md)
- [Service requests flow](docs/SERVICE_REQUESTS_FLOW.md)

Engineering:

- [Architecture](docs/architecture.md)
- [Domain model](docs/domain-model.md)
- [Security model](docs/security-model.md)
- [Current status](docs/current-status.md)

Payments:

- [Payments foundation](docs/PAYMENTS_FOUNDATION.md)
- [Payments security](docs/PAYMENTS_SECURITY.md)
- [Payments flow](docs/PAYMENTS_FLOW.md)
- [Payout system](docs/PAYOUT_SYSTEM.md)
- [Cancellation and refund policy](docs/CANCELLATION_REFUND_POLICY.md)

Operations:

- [Pilot checklist](docs/PILOT_CHECKLIST.md)
- [Pilot runbook](docs/PILOT_RUNBOOK.md)
- [Observability runbook](docs/OBSERVABILITY_RUNBOOK.md)

Decisions:

- [ADR index](docs/README.md#decisions)

## Important Limitations

- The application Dockerfiles and local compose stack are available for
  validation, but production deploy/release automation is still not implemented.
- External payment gateways are simulated/prepared, not live production
  integrations.
- S3 upload presign support is backend-only and has MIME, size, expiry,
  ownership, state, and server-generated key policy. Malware/content scanning
  and frontend upload UI are not implemented.
- Email verification, phone verification, and full self-service password reset
  are not implemented.
- There is no Redis/queue worker process today; timer/runner work lives inside
  the API.
- CI includes a real browser-to-API-to-PostgreSQL integration job for the core
  marketplace path, but does not yet build Docker images.

## Out Of Scope

MozScam/Moses Cam is a separate project. Tchuno does not include scam-number
reporting, scam detection, mobile money fraud databases, or MozScam-specific
architecture.
