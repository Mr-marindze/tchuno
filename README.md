# Tchuno Monorepo

## Prerequisites

- Node 20
- Yarn
- Docker

## Commands

```bash
docker compose up -d
yarn install
yarn dev
```

## Quality Checks

```bash
yarn lint
yarn test
yarn test:e2e
yarn ci
```

## Observability

- Health: `GET /observability/health`
- Metrics (Prometheus): `GET /observability/metrics`
