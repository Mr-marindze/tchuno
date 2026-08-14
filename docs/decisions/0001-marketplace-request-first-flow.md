# ADR 0001: Marketplace Request-First Flow

## Status

Accepted

## Context

Tchuno originally had a direct job creation path, but the consolidated product
flow is marketplace oriented. Customers should describe a need, providers should
submit proposals, and the customer should select one proposal before a job is
created.

## Decision

The official flow is:

`ServiceRequest -> Proposal -> Selection -> Job`

The old direct job creation and direct quote-on-job paths are not supported
product flows.

## Consequences

- `POST /jobs` remains blocked with `410 Gone`.
- `PATCH /jobs/:id/quote` remains blocked with `410 Gone`.
- New jobs should be request-backed and proposal-backed.
- Product UI should guide customers to create requests, not direct jobs.
- Legacy jobs may exist historically but should not be used as the official
  execution path.

## Related Documents

- [Product flow](../PRODUCT_FLOW.md)
- [Service requests flow](../SERVICE_REQUESTS_FLOW.md)
- [Domain model](../domain-model.md)
