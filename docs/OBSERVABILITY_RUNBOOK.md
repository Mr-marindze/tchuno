# Observability Runbook

## Scope

This runbook defines the minimum operational observability baseline for pilot mode.

## Endpoints

- Health: `GET /observability/health`
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
2. No sustained increase in `5xx` responses.
3. Login success/failure ratio is stable.
4. Job funnel shows progression to `COMPLETED`.
5. Review creation events are present after completed jobs.

## Incident Triage (Quick)

1. Capture `x-request-id` from failing client request.
2. Search structured logs by `requestId`.
3. Check metrics for the same route/status window.
4. Validate DB and API status.
5. Open incident note with timestamp, scope, root cause, fix.
