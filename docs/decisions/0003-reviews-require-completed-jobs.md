# ADR 0003: Reviews Require Completed Jobs

## Status

Accepted

## Context

Reviews should represent reputation earned through real service relationships,
not public comments detached from completed work.

## Decision

Reviews are tied to jobs and can only be created by the job client after the job
is completed.

## Consequences

- One review exists per job.
- Only the client can review.
- Jobs must be `COMPLETED` before review creation.
- Worker profile rating aggregates update from persisted reviews.
- Public profile reputation is grounded in completed service work.

## Related Documents

- [Domain model](../domain-model.md)
- [Current status](../current-status.md)
