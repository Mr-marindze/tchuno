# Personas And Roles

This document captures only personas justified by the current product and roles
visible in the application.

## Product Personas

### Cliente

A person who needs a service and wants to create a request, compare proposals,
select a provider, pay or unlock the protected flow, track execution, and leave
a review after completion.

Related technical role: `customer`.

### Prestador

A person or small operator who offers services, maintains a worker profile,
receives open requests or invitations, submits proposals, executes selected
jobs, communicates with customers, and tracks earnings.

Related technical role: `provider`.

Current implementation note: provider status is inferred from the existence of a
`WorkerProfile`, not from a separate platform role.

### Administrador/Ops

A platform operator responsible for trust, support, payments, refunds, payouts,
settings, audit review, user management, or incident handling.

Related technical roles:

- `admin`
- `support_admin`
- `ops_admin`
- `super_admin`

These are technical authorization roles and may map to different operational
responsibilities in the business.

## Role Notes

- `customer` is the default application role for normal authenticated users
  without a worker profile.
- `provider` is derived from `WorkerProfile` existence.
- Admin subroles are represented by `User.adminSubrole`.
- Permissions are enforced by backend guards and are documented in
  [security-model.md](security-model.md).
