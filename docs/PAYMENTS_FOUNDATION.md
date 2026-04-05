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
- Real providers (`MPESA`, `EMOLA`, `MKESH`) are modeled but not integrated yet.

## Implemented API Surface

### Customer

- `POST /payments/intents`
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
- `POST /admin/payments/refunds`
- `POST /admin/payments/payouts`
- `POST /admin/payments/payouts/:id/approve`
- `POST /admin/payments/payouts/:id/process`
- `POST /admin/payments/release/:jobId`

### System

- `POST /payments/webhooks/:provider`
- `POST /payments/transactions/:id/reconcile`

## Current UI

- `/app/pagamentos` now lists customer payment intents.
- `/pro/ganhos` now shows provider balances and movement history.

## Next Integration Step

Implement provider adapters that satisfy the existing gateway interface:

- `requestCharge`
- `queryTransactionStatus`
- `requestRefund`
- `requestPayout`
