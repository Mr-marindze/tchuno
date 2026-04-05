# Pilot User Test Script

## Goal

Validate whether real users can complete the core marketplace flow with low friction:

`client -> create request -> providers propose -> client selects -> deposit payment -> execution -> review`

## Participants

Target:
- 5 clients
- 3 workers

Basic criteria:
- mix of mobile + desktop users
- at least 2 users with low/unstable connectivity

## Test Setup

1. Use staging environment.
2. Provide each participant with a test account.
3. Capture session notes and timestamps.
4. Record request IDs for any blocker.

## Scenario Tasks

### Client tasks

1. Register or login.
2. Create one `ServiceRequest`.
3. Review multiple proposals.
4. Select one proposal.
5. Pay deposit.
6. Confirm contact unlock happened only after payment.
7. Track execution status updates.
8. Leave a review after completion.

### Worker tasks

1. Login and verify profile details.
2. Open available service requests.
3. Submit one proposal with price and comment.
4. If selected, progress job status:
   - `REQUESTED -> ACCEPTED`
   - `ACCEPTED -> IN_PROGRESS`
   - `IN_PROGRESS -> COMPLETED`

## Success Metrics

1. Task completion rate >= 80%.
2. Median time to create first request <= 3 minutes.
3. Median time from proposal selection to deposit payment <= 5 minutes.
4. No Sev1/Sev2 incident during session.

## Error Capture Template

For each issue capture:
- user type (client/worker)
- step
- expected behavior
- actual behavior
- timestamp
- requestId (if available)
- device + browser

## Debrief Questions

1. What was confusing?
2. Where did you hesitate?
3. Did any message feel unclear?
4. Would you trust this flow in real life?
5. Was payment/contact-unlock logic clear and fair?

## Output

At the end of the pilot test cycle, produce:
- prioritized issue list (P0/P1/P2)
- top UX fixes
- go/no-go recommendation for expanded pilot
