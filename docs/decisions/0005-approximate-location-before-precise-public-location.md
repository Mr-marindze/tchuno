# ADR 0005: Approximate Location Before Precise Public Location

## Status

Accepted

## Context

Location helps customers and providers understand practical fit. At the same
time, exposing precise location too early can create privacy and safety risks,
especially before trust and payment protections are active.

The current implementation stores text location and service area preferences.
It does not implement GPS or advanced geospatial matching.

## Decision

Tchuno should prefer approximate or administrative location first. Precise public
location should not be exposed until there is a specific product and security
decision.

## Consequences

- Current location capability remains partial.
- Documentation must not claim advanced GPS/proximity matching.
- Matching should start simple, deterministic, and explainable.
- Future geodata work must consider privacy, connectivity, and operational
  safety.

## Related Documents

- [Product vision](../product-vision.md)
- [Current status](../current-status.md)
- [Domain model](../domain-model.md)
