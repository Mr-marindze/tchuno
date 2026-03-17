# Tchuno Monorepo

## Prerequisites

- Node 20
- Corepack enabled (`corepack enable`)
- Docker + Docker Compose

## Local Development

```bash
docker compose up -d
corepack yarn install
corepack yarn dev
```

Services:
- API: `http://localhost:3001`
- Web: `http://localhost:3000`
- Swagger: `http://localhost:3001/docs`

## Staging (Pilot Baseline)

1. Create `.env.staging` from `.env.staging.example`.
2. Start staging database:

```bash
corepack yarn staging:db:up
```

3. Apply migrations and seed demo data:

```bash
corepack yarn staging:bootstrap
```

4. Start API and Web (separate terminals):

```bash
corepack yarn staging:api
corepack yarn staging:web
```

5. Run health checks:

```bash
corepack yarn staging:check
```

Demo users (password: `demo1234`):
- `admin@tchuno.local`
- `client1@tchuno.local`
- `client2@tchuno.local`
- `worker1@tchuno.local`
- `worker2@tchuno.local`

## Quality Checks

```bash
corepack yarn lint
corepack yarn test
corepack yarn test:e2e
corepack yarn ci
```

## Observability

- Health: `GET /observability/health`
- Metrics (Prometheus): `GET /observability/metrics`
