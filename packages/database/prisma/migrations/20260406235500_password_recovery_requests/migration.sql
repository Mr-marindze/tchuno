CREATE TYPE "PasswordRecoveryRequestStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELED'
);

CREATE TABLE "PasswordRecoveryRequest" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "status" "PasswordRecoveryRequestStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PasswordRecoveryRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordRecoveryRequest_email_status_requestedAt_idx"
ON "PasswordRecoveryRequest"("email", "status", "requestedAt");

CREATE INDEX "PasswordRecoveryRequest_userId_status_requestedAt_idx"
ON "PasswordRecoveryRequest"("userId", "status", "requestedAt");

CREATE INDEX "PasswordRecoveryRequest_status_requestedAt_idx"
ON "PasswordRecoveryRequest"("status", "requestedAt");

CREATE INDEX "PasswordRecoveryRequest_resolvedByUserId_updatedAt_idx"
ON "PasswordRecoveryRequest"("resolvedByUserId", "updatedAt");

ALTER TABLE "PasswordRecoveryRequest"
ADD CONSTRAINT "PasswordRecoveryRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PasswordRecoveryRequest"
ADD CONSTRAINT "PasswordRecoveryRequest_resolvedByUserId_fkey"
FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
