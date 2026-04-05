# Product Flow Decision

## Official Flow (Single Source of Truth)

Tchuno now operates with one official service lifecycle:

1. `ServiceRequest` (customer opens request)
2. `Proposal` (providers submit offers)
3. customer selects one proposal
4. backend creates `Job` + deposit `PaymentIntent`
5. customer pays deposit
6. contact is unlocked
7. provider executes: `REQUESTED -> ACCEPTED -> IN_PROGRESS -> COMPLETED`

## Deprecated / Removed Flow

The legacy direct job flow is disabled:

- `POST /jobs` returns `410 Gone`
- `PATCH /jobs/:id/quote` returns `410 Gone`

Direct quote negotiation on `Job` is no longer part of product behavior.

## Enforcement Rules

- Execution transitions require request-backed jobs:
  - `job.requestId` and `job.proposalId` must exist.
- Execution transitions also require paid deposit:
  - latest payment intent must be `PAID_PARTIAL` or `SUCCEEDED`.
- Contact stays blocked until payment confirmation.

## Data Model Expectation

New jobs are expected to be created from selected proposals and therefore carry:

- `job.requestId`
- `job.proposalId`
- `job.agreedPrice`

## Migration Note

Historical legacy jobs may still exist in the database. They are not valid for the
official creation/execution workflow and should be migrated, closed, or archived
according to operations policy.
