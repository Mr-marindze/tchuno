# Contributing

Thanks for helping build Tchuno. This repository is already an advanced MVP, so
contributions should preserve the current product and architecture baseline
unless a task explicitly approves a change.

## Ground Rules

- Work from a dedicated branch, not directly on `main`.
- Keep each PR focused on one task.
- Do not change product vision, roadmap, architecture, payments strategy, or
  security posture without an approved decision.
- Do not commit real secrets.
- Do not rewrite existing migrations.
- Do not bypass tests, validation, ownership checks, or authorization rules to
  make a flow work.

## Development Flow

1. Sync the latest `main`.
2. Create a branch with a clear prefix, such as `feat/`, `fix/`, `chore/`,
   `docs/`, or `test/`.
3. Make focused changes.
4. Run the relevant checks.
5. Open a pull request into `main`.
6. Address review comments and wait for green CI.

## Commit Style

Use concise conventional-style subjects:

```text
feat: add provider proposal filtering
fix: preserve service request ownership checks
docs: clarify pilot setup
chore: update repository templates
```

## Checks

Documentation-only changes:

```bash
git diff --check
```

General code changes:

```bash
corepack yarn lint
corepack yarn test
```

Broader validation when relevant:

```bash
corepack yarn test:e2e
corepack yarn test:smoke:web
corepack yarn test:integration:web-api
corepack yarn ci
```

Database-related changes:

```bash
corepack yarn workspace @tchuno/database prisma validate
corepack yarn workspace @tchuno/database generate
```

## Pull Request Checklist

Before requesting review, confirm:

- The PR targets `main`.
- The description explains the change and validation.
- Scope is limited to the task.
- Docs are updated when behavior, setup, operations, or decisions changed.
- New or changed code has appropriate tests.
- CI is green or known failures are explained.

## Review Expectations

Reviewers should focus on correctness, product alignment, security, tests, and
maintainability. Small style issues should be handled only when they improve
clarity or consistency.

## Repository Protection Recommendation

For team collaboration, `main` should require pull requests, at least 1 approval,
green required checks, CODEOWNERS review, resolved conversations, and should
block force pushes and branch deletion.

Recommended required checks:

- `lint-and-test`
- `coverage`
- `docker-build`
- `e2e`
- `integration-web-api`
- `smoke-web`
