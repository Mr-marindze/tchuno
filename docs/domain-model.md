# Domain Model

This document explains the current domain model at a product and engineering
level. It is based on the Prisma schema and services, not on future plans.

It intentionally does not copy the full Prisma schema. Use
`packages/database/prisma/schema.prisma` for field-level detail.

## Core Identity

### User

Represents an account.

Key responsibilities:

- authentication identity;
- platform role (`USER` or `ADMIN`);
- admin subrole when applicable;
- ownership of sessions, service requests, proposals, jobs, payments, audit
  logs, notifications, and operational records.

Important rules:

- inactive users cannot authenticate through the JWT strategy;
- provider capability is derived from a linked `WorkerProfile`;
- admins may have subroles: `SUPPORT_ADMIN`, `OPS_ADMIN`, `SUPER_ADMIN`.

### Session

Represents refresh-token backed login state.

Important rules:

- refresh tokens are stored as hashes;
- sessions can be revoked individually or globally;
- refresh reuse detection revokes token chains.

## Marketplace Catalog

### Category

Represents a platform-controlled category such as plumbing, electrical work, or
cleaning.

Important rules:

- categories have `slug`, `isActive`, and `sortOrder`;
- normal users and providers do not create categories directly;
- free-form request descriptions do not become categories automatically.

### WorkerProfile

Represents the public and operational provider profile linked one-to-one with a
`User`.

Key relationships:

- belongs to one `User`;
- has many categories through `WorkerProfileCategory`;
- receives jobs and reviews.

Important fields:

- `publicName`, `bio`, `location`, `serviceAreaPreferences`;
- `hourlyRate`, `experienceYears`;
- `isAvailable`, `availabilityStatus`;
- `ratingAvg`, `ratingCount`.

## Request-First Marketplace Flow

### ServiceRequest

Represents a customer request for service.

Key relationships:

- owned by customer `User`;
- belongs to one `Category`;
- has many `Proposal` records;
- may have many `RequestInvitation` records;
- may select one `Proposal`;
- may create one `Job`.

Status:

- `OPEN`
- `CLOSED`
- `EXPIRED`

Important rules:

- only the customer owner can update, invite, select, or read private request
  detail;
- requests expire through service logic;
- selected requests close and produce a job.

### RequestInvitation

Represents a customer invitation to a provider to respond to a request.

Status:

- `SENT`
- `ACCEPTED`
- `DECLINED`
- `EXPIRED`

Important rules:

- unique per request/provider pair;
- accepted when the invited provider submits a proposal;
- expires when the request is no longer open.

### Proposal

Represents a provider offer for a service request.

Status:

- `SUBMITTED`
- `SELECTED`
- `REJECTED`

Important rules:

- each provider can have one proposal per request;
- providers cannot propose to their own request;
- selected proposal creates a job and rejects other proposals.

### Job

Represents the execution record after selection.

Status:

- `REQUESTED`
- `ACCEPTED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELED`

Important rules:

- official jobs should have `requestId` and `proposalId`;
- legacy direct jobs cannot progress through the official execution flow;
- execution transitions require a paid deposit intent where applicable;
- contact data remains locked until payment is confirmed or `contactUnlockedAt`
  is set.

### Review

Represents customer feedback for a completed job.

Important rules:

- one review per job;
- only the job client can review;
- reviews require `COMPLETED` jobs;
- worker profile rating aggregates update after review creation.

## Communication And Notifications

### UserNotification

Represents in-app notifications for events such as invitations, proposals,
messages, refunds, and trust/safety updates.

### JobMessage

Represents messages between job participants.

Important rules:

- only customer/provider participants can access a conversation;
- messages for canceled jobs are blocked;
- trust/safety checks run before storing messages when contact is locked.

### JobMessageAttachment

Represents attachment metadata for job messages.

Current limitation:

- upload support is prepared around S3 presigned URLs, but validation and
  production storage hardening are incomplete.

## Payments

### PaymentIntent

Represents a financial intent linked to a job.

Status:

- `CREATED`
- `AWAITING_PAYMENT`
- `PAID_PARTIAL`
- `PENDING_CONFIRMATION`
- `SUCCEEDED`
- `FAILED`
- `EXPIRED`
- `CANCELED`

Important rules:

- created after proposal selection for deposit flow;
- amount split is computed by backend;
- live external gateway integration is not considered complete.

### PaymentTransaction

Represents a provider/internal payment operation attempt.

Types:

- `CHARGE`
- `PAYOUT`
- `REFUND`
- `REVERSAL`
- `ADJUSTMENT`

Important rules:

- idempotency key is unique;
- provider reference is unique per provider where present.

### LedgerEntry

Represents append-only accounting movement.

Important rules:

- financial state is represented through ledger entries rather than silent
  balance mutation;
- entries are connected to jobs, intents, transactions, or admins where
  relevant.

### Payout

Represents provider payout lifecycle.

Status:

- `PENDING`
- `APPROVED`
- `PROCESSING`
- `PAID`
- `FAILED`
- `CANCELED`

### RefundRequest

Represents a refund/dispute request.

Status:

- `PENDING`
- `APPROVED`
- `PROCESSING`
- `SUCCEEDED`
- `FAILED`
- `CANCELED`

## Trust, Safety, And Operations

### AuditLog

Represents persistent security/admin audit events.

Examples:

- admin login;
- forbidden access;
- critical admin action;
- reauth success/failure;
- user role/status changes;
- exports and settings changes.

### ReauthChallenge

Represents short-lived one-use reauthentication tokens for critical actions.

### TrustSafetyIntervention

Represents moderation action around risky messaging or behavior.

Risk levels:

- `LOW`
- `MEDIUM`
- `HIGH`

Actions:

- `WARNING`
- `TEMP_BLOCK`

### OperationalIncident

Represents support, dispute, trust/safety, or platform incidents with SLA,
owner, status, evidence, and timeline events.

### PlatformSetting

Represents operational configuration updated through admin flows.

## Tracking

### TrackingWorkerAggregate

Stores aggregated marketplace behavior for worker ranking.

### TrackingCategoryAggregate

Stores aggregated category behavior.

Current limitation:

- tracking and matching are simple and explainable, not advanced algorithmic
  matching.
