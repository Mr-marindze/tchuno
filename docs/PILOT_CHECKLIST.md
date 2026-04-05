# Real Pilot Readiness Checklist

References:

- `docs/PRODUCT_FLOW.md`
- `docs/PAYMENTS_FLOW.md`
- `docs/CANCELLATION_REFUND_POLICY.md`
- `docs/PAYOUT_SYSTEM.md`
- `docs/ANTI_LEAKAGE_UX.md`
- `docs/PILOT_RUNBOOK.md`

## 1. Flow Integrity (Mandatory)

- Customer can only start by creating `ServiceRequest`.
- Providers can submit multiple `Proposal` entries per request.
- Customer can select exactly one proposal.
- `Job` is created only from selected proposal (`requestId` + `proposalId` present).
- `POST /jobs` direct creation remains disabled (`410 Gone`).
- Contact remains locked until deposit payment confirmation.
- Execution transitions are blocked if no paid `PaymentIntent`.

## 2. Financial Readiness (Mandatory)

- Commission is calculated only on backend.
- `PaymentIntent` is created immediately after selection.
- Deposit payment writes append-only ledger entries:
  - `CUSTOMER_CHARGE`
  - `PLATFORM_FEE_RESERVED`
  - `PROVIDER_BALANCE_HELD`
- Refund policy is enforced by phase with `cancelReason` required.
- Release after `COMPLETED` + dispute window.
- Payout lifecycle (`PENDING -> APPROVED -> PROCESSING -> PAID/FAILED`) is operational.
- Daily reconciliation run exists and is tested.

## 3. Security and Fraud Controls (Mandatory)

- Idempotency is enforced for payment, refund, payout and webhook handling.
- Admin financial actions use RBAC + re-auth.
- Audit logs exist for intent, charge, refund, release and payout actions.
- Duplicate/replay events are safely deduplicated.
- Risk events for leakage attempts are logged and observable.

## 4. UX and Behavioral Alignment (Mandatory)

- No legacy direct-job CTA remains in customer or provider UI.
- Contact lock/unlock states are explicit and understandable.
- Proposal selection screen explains deposit and protection value.
- Payment pending/failure/retry states are clear and actionable.
- Refund and cancellation expectations are shown before confirmation.

## 5. Operational Readiness (Mandatory)

- Health and metrics endpoints are reachable in staging/production.
- Support playbook includes cancellation, refund and payout cases.
- Finance owner is assigned for reconciliation and payout exceptions.
- Incident response owner and escalation channel are defined.
- SLA targets are agreed for refund and payout operations.

## 6. Validation Commands (Release Gate)

- `corepack yarn lint`
- `corepack yarn test`
- `corepack yarn test:e2e`
- `corepack yarn ci`

All must pass before pilot start.

## 7. Pilot Dry-Run Scenarios (Must Pass)

- Request creation -> multi-proposal -> selection -> job creation.
- Selection -> payment intent -> successful deposit -> contact unlock.
- Duplicate payment callback does not duplicate ledger entries.
- Cancel before payment.
- Cancel after payment and before `IN_PROGRESS` (full refund path).
- Cancel after `IN_PROGRESS` (partial/manual path).
- `COMPLETED` -> release funds after window -> payout execution.
- Unauthorized admin user blocked from refund/payout approval actions.

## 8. Go / No-Go Decision

Go only if:

- all mandatory sections above are green
- zero unresolved Sev1/Sev2 defects
- finance reconciliation mismatch is zero or understood with mitigation
- support and operations team sign-off is recorded

Otherwise: No-Go and delay pilot.
