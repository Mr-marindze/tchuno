# Tchuno Documentation

This directory is the main knowledge base for the Tchuno project. It documents
the current product, architecture, decisions, status, and operational guidance.

Documentation should distinguish current implementation from approved decisions,
partial capabilities, future work, and undecided ideas.

## Product

- [Product vision](product-vision.md)
- [Project context](project-context.md)
- [Personas](personas.md)
- [Product flow](PRODUCT_FLOW.md)
- [Service requests flow](SERVICE_REQUESTS_FLOW.md)
- [Categories catalog](CATEGORIES_MVP_CATALOG.md)

## Engineering

- [Architecture](architecture.md)
- [Domain model](domain-model.md)
- [Security model](security-model.md)
- [Access phase 2 security](ACCESS_PHASE2_SECURITY.md)
- [Observability runbook](OBSERVABILITY_RUNBOOK.md)

## Status And Planning

- [Current status](current-status.md)
- [Roadmap](roadmap.md)
- [Root backlog](../BACKLOG.md)
- [QA real-world checklist](../QA_REAL_WORLD.md)

## Payments

- [Payments foundation](PAYMENTS_FOUNDATION.md)
- [Payments flow](PAYMENTS_FLOW.md)
- [Payments security](PAYMENTS_SECURITY.md)
- [Payout system](PAYOUT_SYSTEM.md)
- [Cancellation and refund policy](CANCELLATION_REFUND_POLICY.md)
- [Anti-leakage UX](ANTI_LEAKAGE_UX.md)

## Operations And Pilot

- [Pilot checklist](PILOT_CHECKLIST.md)
- [Pilot runbook](PILOT_RUNBOOK.md)
- [Backup and restore runbook](BACKUP_RESTORE_RUNBOOK.md)
- [Pilot user test script](PILOT_USER_TEST_SCRIPT.md)
- [Pilot feedback template](PILOT_FEEDBACK_TEMPLATE.md)
- [Password reset runbook](PASSWORD_RESET_RUNBOOK.md)

## Decisions

Architecture Decision Records live in [decisions/](decisions/).

- [ADR 0001: Marketplace request-first flow](decisions/0001-marketplace-request-first-flow.md)
- [ADR 0002: Controlled categories with flexible request descriptions](decisions/0002-controlled-categories-flexible-requests.md)
- [ADR 0003: Reviews require completed jobs](decisions/0003-reviews-require-completed-jobs.md)
- [ADR 0004: Payments are a domain boundary and live gateways are deferred](decisions/0004-payments-domain-live-gateways-deferred.md)
- [ADR 0005: Approximate location before precise public location](decisions/0005-approximate-location-before-precise-public-location.md)

## Out Of Scope

MozScam/Moses Cam is a separate project. Tchuno documentation must not include
scam-number reporting, scam detection, mobile money fraud databases, or
MozScam-specific architecture.
