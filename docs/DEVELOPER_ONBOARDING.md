# Developer Onboarding

This guide helps a new contributor set up Tchuno, understand the current
baseline, and submit changes through review without changing product direction.

Tchuno is a Mozambican services marketplace. The current product flow is
request-first:

```text
ServiceRequest -> Proposal -> Selection -> Job -> PaymentIntent -> payment/contact unlock -> execution -> Review
```

Do not reintroduce direct job creation as the main flow, and do not change the
product vision, roadmap, architecture, payments model, or security model unless
there is an approved task or decision.

## Prerequisites

- Node.js 20
- Corepack enabled
- Docker and Docker Compose
- Git

The repository uses Yarn 4.13.0 through `packageManager`.

## First Setup

```bash
corepack enable
corepack yarn install
cp .env.example .env
corepack yarn db:up
corepack yarn db:migrate
corepack yarn db:seed
```

Start the local services:

```bash
corepack yarn dev
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- API docs: `http://localhost:3001/docs`

## Read Before Changing Code

Start with:

- `README.md`
- `AGENTS.md`
- `docs/README.md`
- `docs/current-status.md`
- `docs/product-vision.md`
- `docs/architecture.md`
- `docs/security-model.md`
- `docs/domain-model.md`
- `docs/roadmap.md`

For feature work, also read the relevant specialist docs under `docs/`, such as
product flow, service requests, payments, pilot operations, and ADRs.

## Monorepo Map

```text
apps/api          NestJS REST API
apps/web          Next.js web app
packages/database Prisma schema, migrations, seed, catalog and ops scripts
docs              Product, architecture, security, status, and operations docs
```

## Branch Workflow

1. Create a branch from the latest `main`.
2. Keep changes focused on the issue or task.
3. Run the relevant checks before opening a PR.
4. Open a PR into `main`.
5. Wait for review and green CI before merge.

Suggested branch prefixes:

- `feat/` for user-visible product changes
- `fix/` for bug fixes
- `chore/` for maintenance and repository work
- `docs/` for documentation-only changes
- `test/` for test-only changes

## Validation

For documentation-only changes:

```bash
git diff --check
```

For code changes, start with:

```bash
corepack yarn lint
corepack yarn test
```

Use broader checks when the change touches those areas:

```bash
corepack yarn test:e2e
corepack yarn test:smoke:web
corepack yarn test:integration:web-api
corepack yarn ci
```

Database work should include:

```bash
corepack yarn workspace @tchuno/database prisma validate
corepack yarn workspace @tchuno/database generate
```

## Pull Request Expectations

Each PR should explain:

- What changed
- Why it changed
- How it was validated
- Any risks, migrations, or follow-up work

PRs should stay small enough to review carefully. Split unrelated work into
separate branches.

## Main Branch Protection Recommendation

`main` should be protected before multiple developers start contributing:

- Require pull requests before merging.
- Require at least 1 approval.
- Require review from CODEOWNERS.
- Require all required CI checks to pass.
- Block force pushes.
- Block branch deletion.
- Dismiss stale approvals when new commits are pushed.
- Require conversations to be resolved before merge.

Recommended required checks from the current workflow:

- `lint-and-test`
- `coverage`
- `docker-build`
- `e2e`
- `integration-web-api`
- `smoke-web`

At the time this document was added, repository rulesets were not configured and
`main` was reported as unprotected by the public branch metadata.
