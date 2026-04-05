# Payments Security Baseline

## Threats Addressed

- Fake client-side "payment success" claims.
- Duplicate callback/replay events.
- Double processing of transactions.
- Unauthorized admin financial actions.
- Silent balance mutation without audit trail.

## Controls Implemented

1. Server-side source of truth
- Split and fee are computed in backend only.
- UI is read-only for financial state.

2. Idempotency and uniqueness
- `PaymentTransaction.idempotencyKey` is unique.
- Provider reference uniqueness is enforced per provider.
- Webhook events are deduplicated via `(provider, externalEventId)`.

3. Append-only ledger
- Financial state mutations are recorded as `LedgerEntry` rows.
- No balance column is edited directly.

4. Admin hardening
- Admin financial routes require RBAC permission `admin.payments.manage`.
- Critical financial actions use re-auth (`@RequireReauth`).
- Admin actions are captured by audit interceptor.

5. Reconciliation hooks
- Webhook endpoint persists raw event payloads.
- Manual reconciliation endpoint allows server-side status refresh.

6. Contact-gating control
- Job contact remains blocked before paid deposit.
- Contact is unlocked only after backend-confirmed payment state.

## Minimum Ops Practices

- Track failed transactions and pending intents daily.
- Investigate any mismatch between transaction status and ledger outcome.
- Restrict production webhook access to trusted provider origins when available.
