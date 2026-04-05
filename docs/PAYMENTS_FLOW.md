# Payments Flow (Current Foundation)

## 1) Create Intent

1. Customer calls `POST /payments/intents` with `jobId`.
2. Backend validates job ownership and amount source:
- `FIXED_PRICE` -> `budget`
- `QUOTE_REQUEST` -> `quotedAmount`
3. Backend computes split:
- gross
- platform fee
- provider net
4. Backend creates `PaymentIntent` in `AWAITING_PAYMENT`.

## 2) Pay Intent (Deposit or Charge)

1. Customer calls `POST /payments/intents/:id/pay`.
2. Gateway charge is requested using idempotency key.
3. Transaction is recorded and intent transitions according to payment result.
4. For deposit intents (`metadata.kind=deposit`) paid state becomes `PAID_PARTIAL`.

## 3) Charge Status

- Internal gateway returns one of:
- `PENDING`
- `SUCCEEDED`
- `FAILED`
- `REVERSED`
- External-simulated adapters (`MPESA`, `EMOLA`) default to async `PENDING` and move via reconciliation/webhook.
- On paid success, ledger receives:
- `CUSTOMER_CHARGE`
- `PLATFORM_FEE_RESERVED`
- `PROVIDER_BALANCE_HELD`

## 4) Release Provider Funds

Admin triggers `POST /admin/payments/release/:jobId`.

Release is allowed only when:

- job status is `COMPLETED`
- release delay window has passed

Ledger move:

- debit `PROVIDER_HELD`
- credit `PROVIDER_AVAILABLE`

## 5) Payout

1. Admin creates payout request.
2. Admin approves payout.
3. Admin processes payout.
4. On success ledger move:
- debit `PROVIDER_AVAILABLE`
- credit `PROVIDER_PAID_OUT`

## 6) Refund

1. Admin creates refund for a succeeded intent.
2. Refund transaction is created and processed.
3. On success ledger entries debit platform/provider buckets and credit customer refund.

## 7) Monitoring

- `/admin/payments/overview` exposes operational payment KPIs.
- Provider summary endpoint exposes held/available/paid-out balances.
- `/admin/payments/reconcile/pending` allows manual batch reconciliation trigger.
- Automatic reconciliation runner scans stale pending charges on interval.
