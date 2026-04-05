# Provider Payout System (Production)

## 1) Objective

Define how provider money moves from `held` to real payout with control, auditability and fraud resistance.

## 2) Scope

Applies to jobs in official flow:

`ServiceRequest -> Proposal -> Selection -> Job -> Deposit payment -> Execution -> Completion -> Release -> Payout`

## 3) Ledger Buckets

- `PROVIDER_HELD`: provider share after customer payment, before release.
- `PROVIDER_AVAILABLE`: releasable provider balance.
- `PROVIDER_PAID_OUT`: settled payout balance.

All balance movements are append-only ledger events.

## 4) Payout Lifecycle

1. Customer payment succeeds (`PAID_PARTIAL` or `SUCCEEDED`)
2. Provider share goes to `PROVIDER_HELD`
3. Job reaches `COMPLETED`
4. Dispute window elapses (default 24h) and no blocking dispute exists
5. Funds are released (`HELD -> AVAILABLE`)
6. Payout request created
7. Payout approved
8. Payout processed by gateway
9. On success: `AVAILABLE -> PAID_OUT`

## 4.1 State Machine (Required)

`PENDING -> APPROVED -> PROCESSING -> PAID`

Failure branches:

- `PENDING -> CANCELED`
- `APPROVED -> CANCELED`
- `PROCESSING -> FAILED` (retryable)

Rules:

- only finance/admin role can approve/process
- only `PENDING` payouts can be approved
- only `APPROVED` payouts can move to `PROCESSING`
- only gateway-confirmed results can set `PAID`

## 5) Eligibility Rules

Provider can receive payout only if:

- account active and not blocked
- payout profile valid (MSISDN/account details)
- KYC status meets pilot threshold
- available balance >= minimum payout amount
- no active fraud/dispute hold on relevant balance

Additional checks:

- recent payout destination changes may trigger cooling-off hold (e.g. 24h)
- provider must have accepted current payout terms/version

## 6) Settlement Cadence

Recommended pilot cadence:

- cut-off: daily 17:00 local
- batch execution: T+1 business day
- urgent manual payout: admin-only exception with re-auth

## 7) Amount Rules

- default minimum payout: `500 MZN` (configurable)
- maximum single payout: configurable risk limit
- payout amount cannot exceed net available after pending reservations
- currency: `MZN` in pilot baseline

## 8) Fees and Charges

- platform commission is taken at charge time into platform reserved bucket
- gateway payout fee policy options:
  - platform absorbs fee (simpler UX)
  - provider pays fee (clear statement required)
- fee strategy must be explicit in provider statements

## 9) Failure and Retry Policy

If payout fails:

- status becomes `FAILED`
- failure reason is stored
- funds remain in `PROVIDER_AVAILABLE`
- retry can be triggered with new idempotency key
- repeated failures escalate to support queue

Max retry policy (recommended):

- automatic retries: up to 3 per payout
- after 3 failures: manual investigation required

## 10) Controls and Security

Mandatory controls:

- RBAC: only authorized finance roles can create/approve/process
- re-auth for critical payout actions
- idempotency per payout operation
- provider reference uniqueness and reconciliation checks
- immutable audit trail of all payout actions

Mandatory audit fields:

- `requestedBy`
- `approvedBy`
- `processedBy` (or system worker id)
- `providerReference`
- `idempotencyKey`

Recommended controls for production:

- dual approval above threshold (e.g., >= 100,000 MZN)
- velocity limits per provider/day
- anomaly detection on payout destination changes

## 11) Reconciliation

Daily reconciliation must compare:

- internal payout records vs gateway settlement report
- ledger expected balances vs payout totals
- failed/processing aged items

Mismatch classes:

- missing provider reference
- amount mismatch
- duplicate settlement
- stale `PROCESSING` beyond SLA

Reconciliation outputs:

- daily signed report with totals and mismatches
- aging report for `PROCESSING` and `FAILED`
- corrective action ticket for each mismatch class

## 12) User Experience Requirements

Provider dashboard must show:

- held balance
- available balance
- paid out total
- payout status timeline (`PENDING`, `APPROVED`, `PROCESSING`, `PAID`, `FAILED`)
- clear failure reason and retry/support path

## 13) Operational SLAs

- payout approval decision: <= 24h
- payout processing after approval: <= 24h
- failed payout support response: <= 4h business SLA

## 13.1 Cutover and Rollback

During pilot:

- start with low payout caps and restricted cohort
- enable same-day rollback to manual payout hold if mismatch spikes
- require explicit finance sign-off before increasing payout limits

## 14) Pilot Default Configuration (Suggested)

- release delay: 24h after completion
- minimum payout: 500 MZN
- payout batch: daily
- urgent manual payout: disabled by default
- dual approval: enabled for high amount only

## 15) Gateway Adapter Contract (Future-proof)

Each payout provider adapter must support:

- `requestPayout`
- `queryPayoutStatus`
- `cancelPayout` (if provider supports)
- callback/webhook verification

Provider integration must not change internal payout state rules.
