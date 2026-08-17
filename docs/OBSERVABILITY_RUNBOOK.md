# Observability Runbook

## Scope

This runbook defines the minimum operational observability baseline for pilot mode.

## Endpoints

- Health: `GET /observability/health`
- Readiness: `GET /observability/ready`
- Metrics (Prometheus text): `GET /observability/metrics`
- Swagger: `GET /docs`

## Core Metrics

### HTTP

- `tchuno_api_http_requests_total{method,route,status}`
- `tchuno_api_http_request_duration_ms_bucket{method,route,status,le}`

Use cases:
- detect spikes in `5xx` by route
- track p95 latency on key APIs (`/auth/login`, `/jobs`, `/reviews`)

### Business Events

- `tchuno_api_business_events_total{domain,event,result}`

Domains:
- `auth`
- `jobs`
- `reviews`
- `payments`

Results:
- `success`
- `failed`
- `blocked`

Examples:
- auth successes/failures (`login_success`, `login_failed`, `refresh_success`)
- marketplace flow (`job_created`, `job_status_transition_success`, `review_created`)

### Job Lifecycle

- `tchuno_api_job_status_transitions_total{from,to,result}`

Use cases:
- measure funnel progression (`REQUESTED -> ACCEPTED -> IN_PROGRESS -> COMPLETED`)
- identify rejected transitions (`result="failed"`)

## Log Events

All logs are structured JSON and intentionally exclude token values.

### Request logs (global interceptor)

Key fields:
- `event=http_request`
- `requestId`
- `method`
- `route`
- `statusCode`
- `durationMs`
- `userId`

### Auth audit logs

Examples:
- `register_success`
- `register_conflict`
- `login_success`
- `login_failed`
- `refresh_success`
- `refresh_reuse_detected`
- `logout`
- `logout_all`
- `session_revoke`

### Jobs and Reviews logs

Examples:
- `job_created`
- `job_status_transition_success`
- `job_status_transition_rejected`
- `review_created`
- `review_create_duplicate`

## Operational Checks (Daily)

1. Health endpoint returns `{"status":"ok"}`.
2. Readiness endpoint returns `{"status":"ok"}` and database check `ok`.
3. No sustained increase in `5xx` responses.
4. Login success/failure ratio is stable.
5. Job funnel shows progression to `COMPLETED`.
6. Review creation events are present after completed jobs.

## Pilot Gate Questions

An operator should be able to answer these without code changes:

- Is the API process alive?
  - Check `GET /observability/health`.
- Is the API ready to serve traffic with database access?
  - Check `GET /observability/ready`.
- Which endpoint is failing?
  - Inspect `tchuno_api_http_requests_total` by `route` and `status`.
- Is there a spike in 5xx?
  - Query metrics for `status` values beginning with `5`.
- Which request id belongs to a user-reported failure?
  - Capture the `x-request-id` response header or request log field.
- Is the marketplace flow failing at request, proposal, selection, payment, or
  contact unlock?
  - Correlate HTTP route/status with business events and entity ids.
- Is a payment stuck?
  - Inspect payment intent status, transaction status, provider, and ledger
  entries in the admin payments surface.
- Is an upload failing?
  - Confirm the presign request status, MIME, size, generated key, job
  ownership, and contact unlock state.

## Incident Triage (Quick)

1. Capture `x-request-id` from failing client request.
2. Search structured logs by `requestId`.
3. Check metrics for the same route/status window.
4. Validate DB and API status.
5. Open incident note with timestamp, scope, root cause, fix.

Classify the incident as one of:

- application;
- database;
- payment;
- security;
- abuse/trust-safety;
- availability.

Use `OperationalIncident` through the support ops surface when the issue affects
pilot users, provider work, payment flow, or availability.

## Log Security

Logs may include operational identifiers such as `requestId`, `userId`, route,
status, and entity ids. Logs must not be used as storage for sensitive personal
data.

Do not log:

- passwords;
- access JWTs;
- refresh tokens;
- raw `Authorization` headers;
- secret keys;
- storage credentials;
- full payment provider credentials or webhook secrets.
