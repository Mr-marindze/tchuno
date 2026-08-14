# ADR 0002: Controlled Categories With Flexible Request Descriptions

## Status

Accepted

## Context

The services market is broad and informal. A marketplace needs category
structure for discovery, filtering, and operations, but users must still explain
real needs in their own words.

## Decision

Tchuno uses a controlled category catalog managed by the platform while allowing
free-form service request descriptions.

Descriptions do not automatically create new categories.

## Consequences

- Categories remain normalized and admin-controlled.
- Requests can stay flexible and practical.
- Providers can price through proposals rather than through universal platform
  price tables.
- Catalog changes should be handled intentionally through catalog sync or admin
  operations.

## Related Documents

- [Categories catalog](../CATEGORIES_MVP_CATALOG.md)
- [Product vision](../product-vision.md)
- [Domain model](../domain-model.md)
