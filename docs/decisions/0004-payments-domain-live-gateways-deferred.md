# ADR 0004: Payments Are A Domain Boundary And Live Gateways Are Deferred

## Status

Accepted

## Context

Payments are central to platform trust, contact unlock, refunds, payouts, and
anti-leakage incentives. The current repository contains a payments foundation
with intents, transactions, ledger entries, payouts, refunds, events, and
gateway adapters.

The current external provider adapters are simulated/prepared. They are not live
production integrations.

## Decision

Payments remain a domain boundary in the architecture, but live external payment
gateway integration is deferred until explicitly approved and implemented.

## Consequences

- Backend remains the source of truth for payment state and split computation.
- Ledger entries remain append-only.
- Product and docs must not present M-Pesa/e-Mola simulated adapters as
  production-ready integrations.
- Pilot operation may use internal/simulated provider behavior with clear
  conditions.
- Live gateway work must preserve the gateway boundary and payment security
  controls.

## Related Documents

- [Payments foundation](../PAYMENTS_FOUNDATION.md)
- [Payments flow](../PAYMENTS_FLOW.md)
- [Payments security](../PAYMENTS_SECURITY.md)
- [Current status](../current-status.md)
