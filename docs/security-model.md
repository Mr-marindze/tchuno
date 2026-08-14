# Security Model

This document consolidates the security model that exists today. It also lists
known gaps without treating unverified gaps as confirmed vulnerabilities.

## Authentication

Tchuno uses:

- bcrypt password hashing;
- access JWTs;
- refresh tokens;
- persistent sessions in PostgreSQL;
- httpOnly refresh-token cookies;
- device id tracking for sessions.

Important behaviors:

- refresh tokens are hashed before storage;
- refresh token reuse detection revokes the session chain;
- users with `isActive = false` cannot authenticate;
- users can revoke individual sessions or logout all sessions.

## Authorization

Backend authorization uses:

- `JwtAuthGuard`;
- `AccessPolicyGuard`;
- app roles;
- permissions;
- admin subroles;
- ownership checks inside services.

App roles:

- `guest`
- `customer`
- `provider`
- `admin`
- `support_admin`
- `ops_admin`
- `super_admin`

Provider role is currently derived from `WorkerProfile` existence.

## Permissions And Reauth

Permissions are centralized in the API authorization service.

Critical admin actions can require reauthentication through `@RequireReauth`.
The user confirms their password and receives a short-lived one-use token passed
through `x-reauth-token`.

Examples of protected actions:

- role changes;
- user status changes;
- user deletion;
- category management;
- settings changes;
- exports;
- critical payment actions.

## Input Validation

The API uses a global NestJS `ValidationPipe` with:

- whitelist;
- forbidden non-whitelisted fields;
- forbidden unknown values;
- transformation;
- stop at first error.

DTOs use `class-validator` and `class-transformer`.

## Rate Limiting

The API uses NestJS throttling globally and more specific throttles on sensitive
auth and workflow endpoints.

Examples:

- login;
- register;
- refresh;
- password recovery request;
- job/request actions.

## Audit Logs

Persistent audit logs exist through `AuditLog`.

Captured events include:

- admin login;
- forbidden access;
- reauth success/failure;
- critical admin actions;
- role/status changes;
- data exports;
- platform setting updates.

Sensitive metadata is sanitized by audit code where implemented.

## Ownership Checks

Critical services check ownership explicitly.

Examples:

- only request owner can update/select/invite for a service request;
- providers cannot propose to their own request;
- only job participants can access jobs/messages;
- only job client can create a review;
- only payment/job participants or admins can access payment records where
  applicable.

## Current Known Gaps

These are known gaps or hardening items, not automatically confirmed exploits:

1. Default/fallback secrets exist for development and must be blocked or
   strongly controlled outside development.
2. Upload validation is incomplete; content type and size enforcement need
   hardening.
3. Email verification is not implemented.
4. Phone verification is not implemented.
5. Password recovery is assisted/operational, not full self-service reset.
6. Production deployment security gates are incomplete.
7. External payment providers are simulated, not live production integrations.
8. External observability, alerting, backups, and security scanning are not
   complete.
9. CSRF posture should be reviewed before production, especially around cookie
   and cross-origin deployment choices.

## Related Documents

- [Access phase 2 security](ACCESS_PHASE2_SECURITY.md)
- [Payments security](PAYMENTS_SECURITY.md)
- [Current status](current-status.md)
