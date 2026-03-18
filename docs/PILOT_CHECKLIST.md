# Pilot Operational Checklist

Referências rápidas:
- `docs/PILOT_RUNBOOK.md`
- `docs/PILOT_FEEDBACK_TEMPLATE.md`

## 1. Pre-Pilot (T-7 to T-1)

1. Environment
- Staging database is up and healthy.
- Migrations are applied.
- Demo data seed completed.

2. Application quality
- `corepack yarn lint` passes.
- `corepack yarn test` passes.
- `corepack yarn test:e2e` passes.

3. Security baseline
- JWT secrets are not default values in staging/production.
- Rate limits are active for auth routes.
- Refresh token rotation/reuse detection is validated.

4. Observability
- `/observability/health` reachable.
- `/observability/metrics` reachable.
- Structured logs include `requestId`.

## 2. Pilot Launch Day

1. Verify API and Web are reachable from pilot users.
2. Execute smoke flow:
- register
- login
- create job
- accept/in-progress/complete
- create review
3. Capture first 10 requests with `x-request-id` for traceability.
4. Confirm metrics are incrementing for business events.

## 3. Daily Operations

1. Check health endpoint.
2. Check 5xx rate and auth failure spikes.
3. Verify job status transition volume and completion rate.
4. Confirm review creation after completed jobs.
5. Record top 3 user issues and mitigation action.

## 4. Incident Playbook (Minimum)

1. Severity classification
- Sev1: outage or auth broken
- Sev2: major flow degraded (jobs/reviews)
- Sev3: minor functional issue

2. Response
- open incident channel
- assign owner
- gather `requestId`, timestamp, user impact
- rollback or hotfix

3. Closure
- add root cause
- add prevention action
- add regression test if applicable
