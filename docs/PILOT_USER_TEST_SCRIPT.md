# Pilot User Test Script

## Goal

Validate whether real users can complete the core marketplace flow with low friction:

`client -> create job -> worker handles status -> client leaves review`

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
2. Browse workers and pick one profile.
3. Create a job with title, description and budget.
4. Track job status updates.
5. Leave a review after completion.

### Worker tasks

1. Login and verify profile details.
2. Open assigned job.
3. Progress status:
- `REQUESTED -> ACCEPTED`
- `ACCEPTED -> IN_PROGRESS`
- `IN_PROGRESS -> COMPLETED`

## Success Metrics

1. Task completion rate >= 80%.
2. Median time to create first job <= 3 minutes.
3. Median time to complete full flow <= 10 minutes.
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

## Output

At the end of the pilot test cycle, produce:
- prioritized issue list (P0/P1/P2)
- top UX fixes
- go/no-go recommendation for expanded pilot
