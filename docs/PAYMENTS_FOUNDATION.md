# Payments Foundation (v1)

## Goal

Introduce a safe internal payments domain before integrating real electronic-money APIs.

## Core Principles

1. Keep job lifecycle and payment lifecycle separate.
2. Backend is the source of truth for split, fees and statuses.
3. Ledger entries are append-only.
4. Idempotency keys and provider references are unique where needed.

## New Domain Objects

- `PaymentIntent`: financial intent for a specific job.
- `PaymentTransaction`: external/internal movement attempts (charge, payout, refund).
- `LedgerEntry`: immutable accounting entries.
- `Payout`: provider payout request and processing state.
- `RefundRequest`: refund/reversal request lifecycle.
- `PaymentEvent`: webhook/event persistence for reconciliation and anti-replay.

## Current Provider Mode

- `INTERNAL` mock gateway is active.
- `MPESA` and `EMOLA` now have dedicated adapters in simulated external mode (async/pending-first behavior).
- `MKESH` and `BANK_TRANSFER` still fallback to internal adapter until dedicated adapters are implemented.
- Default provider for new deposit intents can be set via `PAYMENT_DEFAULT_PROVIDER`.

## Implemented API Surface

### Customer

- `POST /payments/intents`
- `POST /payments/intents/:id/pay`
- `GET /payments/intents/:id`
- `GET /payments/jobs/:jobId`
- `GET /payments/me`

### Provider

- `GET /payments/provider/summary`

### Admin

- `GET /admin/payments/overview`
- `GET /admin/payments/intents`
- `GET /admin/payments/transactions`
- `GET /admin/payments/refunds`
- `GET /admin/payments/payouts`
- `POST /admin/payments/refunds`
- `POST /admin/payments/payouts`
- `POST /admin/payments/payouts/:id/approve`
- `POST /admin/payments/payouts/:id/process`
- `POST /admin/payments/release/:jobId`
- `POST /admin/payments/reconcile/pending`

### System

- `POST /payments/webhooks/:provider`
- `POST /payments/transactions/:id/reconcile`

## Current UI

- `/app/pagamentos` now lists customer payment intents.
- `/pro/ganhos` now shows provider balances and movement history.
- `/app/pedidos/[id]` now exposes operational request/proposal/job/payment detail with protected-contact status.
- `/app/mensagens` now reflects protected contact availability by job.
- `/admin/reports` now acts as financial operations panel (KPIs + pending reconciliation actions).

## Request/Proposal Integration

Payment intents are now also created from the request-selection flow:

1. Customer creates `ServiceRequest`
2. Providers submit `Proposal`
3. Customer selects proposal
4. Backend creates `Job` + deposit `PaymentIntent`
5. Customer pays deposit using `/payments/intents/:id/pay`

## Next Integration Step

Move `MPESA`/`EMOLA` adapters from simulated external mode to live API integration while preserving the same gateway interface:

- `requestCharge`
- `queryTransactionStatus`
- `requestRefund`
- `requestPayout`
