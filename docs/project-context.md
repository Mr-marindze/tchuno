# Project Context

Tchuno is an existing monorepo with product code, database migrations,
operational scripts, tests, and documentation. It is not being restarted from
scratch.

## Repository Shape

- `apps/api`: NestJS REST API.
- `apps/web`: Next.js web app.
- `packages/database`: Prisma schema, migrations, seed, catalog scripts, and
  operational database scripts.
- `docs`: product, engineering, payments, security, operations, pilot, and
  decision documentation.

## Current Source Of Truth

GitHub should be the durable source of truth for project memory. Chat history
can explain how decisions were made, but repository documentation should explain
the current state without relying on that history.

## Current Product State

Tchuno is an advanced functional MVP suitable for local development, demos, and
controlled pilot work with conditions. It is not production-ready.

The current implementation includes:

- request-first marketplace flow;
- customer and provider dashboards;
- admin, support, audit, payments, and moderation surfaces;
- PostgreSQL persistence through Prisma;
- JWT authentication, refresh sessions, RBAC, permissions, and reauth;
- payment foundation with simulated/internal gateway behavior;
- tracking, observability, notifications, messages, and reviews.

Known limitations are tracked in [current-status.md](current-status.md).

## Explicit Non-Goals

This repository does not include MozScam/Moses Cam. Do not add scam-number
reporting, scam detection, mobile money fraud classification, or MozScam
architecture to Tchuno documents.

Do not present proposed future capabilities as current implementation.
