# Roadmap

This roadmap distinguishes historical work from current foundation, candidate
next work, and future undecided ideas.

It does not assign a definitive next version number.

## DONE

The repository contains implemented and tested foundations for:

- categories;
- worker profiles;
- request-first marketplace flow;
- proposals and selection;
- jobs and execution status transitions;
- reviews tied to completed jobs;
- authentication and sessions;
- admin access controls and audit logs;
- payments foundation with ledger, intents, refunds, payouts, and simulated
  providers;
- notifications and messages;
- tracking and observability baseline;
- pilot runbooks and QA guidance;
- V1.1 foundation hardening for repeatable demo seed, application Docker
  images, local compose bootstrap, non-development secret validation, and
  database readiness checks;
- V1.2 security and integration hardening for message attachment upload policy
  and real browser-to-API-to-PostgreSQL marketplace integration.
- V1.3 pilot operational gate for executable pilot runbooks, backup/restore,
  Docker build CI coverage, simulated payment-mode clarity, and operational
  readiness evidence.

## CURRENT FOUNDATION

The current foundation is:

- advanced MVP suitable for local development;
- demo-ready with conditions;
- pilot-ready with conditions;
- not production-ready.

Current source of truth:

- [Current status](current-status.md)
- [Product flow](PRODUCT_FLOW.md)
- [Architecture](architecture.md)
- [Domain model](domain-model.md)

## CANDIDATE NEXT

Candidate next work should focus on hardening and reliability before major new
feature expansion:

1. Continue validating the V1.1 Docker runtime under pilot-like data and load.
2. Define deploy/release automation around the application images.
3. Add external secret management and rotation process for staging/pilot.
4. Decide payments path: live provider integration, manual pilot operation, or
   staged hybrid.
5. Add malware/content scanning policy for uploads.
6. Add Docker image publishing/scanning after a deployment target is selected.
7. Clarify provider onboarding and whether provider role remains profile-based.
8. Define staging/deploy/release automation.
9. Replace manual pilot backup with automated managed backup and restore drills.
10. Add security scanning to CI.

## FUTURE / UNDECIDED

These ideas are not approved current scope:

- USSD;
- SMS;
- advanced algorithmic matching;
- precise GPS-based public location;
- full KYC provider verification;
- real-time queue workers;
- production payment provider integrations beyond the current gateway boundary;
- native mobile apps.

Each requires a separate product and engineering decision before implementation.
