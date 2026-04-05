# Cancellation and Refund Policy (Production)

## 1) Objective

Define clear, enforceable, auditable rules for:

- who can cancel
- when cancellation is allowed
- refund amount and timing
- evidence/dispute handling
- anti-fraud controls

This policy applies to jobs created through:

`ServiceRequest -> Proposal -> Selection -> Job -> PaymentIntent (deposit)`

## 2) Definitions

- `Deposit`: amount paid by customer after proposal selection (partial payment).
- `Platform fee`: fee reserved from deposit according to policy.
- `Provider held balance`: provider share kept in hold until release.
- `Dispute window`: post-completion period where release/refund can be blocked.
- `No-show`: confirmed absence of one party at agreed time/place.

## 3) Required Data (Mandatory)

All cancellations must persist:

- `canceledBy`
- `canceledAt`
- `cancelReason`
- `actorRole` (`CUSTOMER`, `PROVIDER`, `ADMIN`, `SYSTEM`)
- optional evidence references (chat, photos, logs)

No cancellation is considered valid without `cancelReason`.

## 4) Cancellation Matrix

### A) Before deposit payment (`PaymentIntent=AWAITING_PAYMENT`)

- Allowed by customer: yes
- Allowed by provider: yes (as withdrawal before commitment)
- Financial outcome: no refund transaction needed
- Required action: close/cancel pending payment intent

### B) After deposit paid, before provider sets `IN_PROGRESS`

- Allowed by customer: yes
- Allowed by provider: yes
- Financial outcome default: full refund of deposit to customer
- Optional penalty: none in pilot baseline
- Ledger action: refund entries must be appended (no mutation in place)

### C) After `IN_PROGRESS` and before `COMPLETED`

- Allowed by customer: yes
- Allowed by provider: yes
- Financial outcome: partial refund policy
- Default baseline split:
  - customer refund: 50% of deposit
  - provider compensation: 50% of provider-held portion (not platform fee by default)
- Final amount can be adjusted by admin decision in dispute

### D) After `COMPLETED`

- Normal cancellation not allowed
- Only dispute/refund flow allowed inside dispute window
- After dispute window and funds release, refund becomes manual exception flow

### E) No-show at scheduled execution

- If provider no-show is confirmed: default `FULL_REFUND` to customer
- If customer no-show is confirmed: default `ZERO_REFUND` (unless provider evidence invalid)
- No-show adjudication must include evidence references and decision note

## 4.1 Status Transition Guards

Minimum enforced guards:

- cannot cancel an already `CANCELED` job
- cannot cancel with empty `cancelReason`
- cannot trigger payout while refund is `PENDING` or `PROCESSING`
- if payout already `PAID`, refund path must be manual adjustment + compensating ledger entries

## 5) Refund Policy Rules

## 5.1 Refund Types

- `FULL_REFUND`: 100% of paid deposit
- `PARTIAL_REFUND`: configurable amount <= refundable balance
- `ZERO_REFUND`: allowed only with explicit adjudication reason

## 5.2 Refund Authorization

- automatic (rule-driven): before service start scenarios
- manual admin (adjudication): in-progress or disputed scenarios
- high-risk/high-value refunds require dual approval (recommended)

## 5.3 SLA Targets

- automatic refunds: initiated <= 15 minutes after valid event
- manual refunds: decision <= 24h (pilot)
- payout/refund conflict case: refund has priority lock before payout processing

## 5.4 Financial Guards

- never refund more than paid amount minus already succeeded refunds
- idempotency key required per refund operation
- duplicate callback/refund requests must be safely deduplicated

## 5.5 Refund Calculation Formula (Canonical)

Definitions:

- `paidTotal`: total customer paid for the job
- `refundedTotal`: sum of succeeded refunds
- `remainingRefundable = max(0, paidTotal - refundedTotal)`

Rules:

- `FULL_REFUND = remainingRefundable`
- `PARTIAL_REFUND = min(requestedAmount, remainingRefundable)`
- phase policy applies first, then `remainingRefundable` cap

Default phase percentages (configurable):

- pre-`IN_PROGRESS`: `100%`
- post-`IN_PROGRESS` pre-`COMPLETED`: `50%`
- post-release exception: admin adjudication only

## 6) Dispute Handling

## 6.1 Dispute Window

- default: 24h after `COMPLETED`

## 6.2 Evidence Sources

- in-app chat history
- timeline/state transition logs
- geo/time metadata when available
- attachments uploaded by parties

## 6.3 Decision Outcomes

- release full provider share
- partial split to customer/provider
- full refund to customer
- account action if fraud pattern detected

## 7) Anti-Fraud and Abuse Controls

- mandatory reason + audit trail for every cancel/refund
- append-only ledger entries for all financial effects
- re-auth for critical admin financial actions
- role-based permissions for approve/process/refund
- replay-safe webhook/event handling and idempotency

Additional controls:

- velocity limits on refund approvals per admin/day
- mandatory second approver above threshold (e.g. `>= 100,000 MZN`)
- automatic risk flag when repeated cancel/refund behavior exceeds threshold

## 8) Backend Implementation Mapping (Current + Required)

Current foundation already supports:

- `cancelReason` validation in status update
- `RefundRequest`, `PaymentTransaction`, `LedgerEntry`
- idempotent transaction keys and append-only accounting model

Required to harden for production:

- explicit refund matrix automation by phase
- dispute entity/workflow (if not yet formalized)
- dual-approval thresholds for high-value manual refunds
- support tooling for evidence adjudication

## 8.1 Operational SLAs

- cancellation event persistence: <= 5 seconds
- automatic refund initiation: <= 15 minutes
- manual adjudication first response: <= 4 business hours
- manual adjudication final decision: <= 24 hours (pilot), <= 12 hours (production target)

## 8.2 Required Events

Emit events for:

- `job.canceled`
- `refund.requested`
- `refund.approved`
- `refund.processed`
- `refund.failed`
- `refund.reversed`

All events must include `jobId`, `actorId`, `requestId` and `idempotencyKey`.

## 9) Communication Policy (User-facing)

Cancellation UI must always show before confirmation:

- refund estimate
- timing expectation
- reason requirement
- effect on reputation/protection where applicable

## 10) Audit and Reporting

Track at minimum:

- cancellation rate by phase
- refund rate and refunded value
- average adjudication time
- no-show incidence by actor
- repeat abuse indicators
