-- CreateEnum
CREATE TYPE "OperationalIncidentEventType" AS ENUM (
  'CASE_OPENED',
  'EVIDENCE_ADDED',
  'OWNER_ASSIGNED',
  'STATUS_CHANGED',
  'SLA_UPDATED',
  'DECISION_RECORDED',
  'CASE_CLOSED'
);

-- CreateEnum
CREATE TYPE "OperationalIncidentEventVisibility" AS ENUM (
  'INTERNAL',
  'PARTICIPANTS'
);

-- AlterTable
ALTER TABLE "OperationalIncident"
ADD COLUMN "assumedAt" TIMESTAMP(3),
ADD COLUMN "baseSlaHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN "slaTargetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill SLA markers for existing incidents
UPDATE "OperationalIncident"
SET "slaTargetAt" = COALESCE("detectedAt", "createdAt") + INTERVAL '24 hours',
    "assumedAt" = CASE
      WHEN "ownerAdminUserId" IS NOT NULL THEN COALESCE("detectedAt", "createdAt")
      ELSE NULL
    END;

-- Remove temporary default so application owns the SLA target calculation
ALTER TABLE "OperationalIncident"
ALTER COLUMN "slaTargetAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "OperationalIncidentEvent" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "eventType" "OperationalIncidentEventType" NOT NULL,
  "visibility" "OperationalIncidentEventVisibility" NOT NULL DEFAULT 'INTERNAL',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorName" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalIncidentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalIncident_status_slaTargetAt_idx"
ON "OperationalIncident"("status", "slaTargetAt");

-- CreateIndex
CREATE INDEX "OperationalIncidentEvent_incidentId_createdAt_idx"
ON "OperationalIncidentEvent"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalIncidentEvent_visibility_createdAt_idx"
ON "OperationalIncidentEvent"("visibility", "createdAt");

-- AddForeignKey
ALTER TABLE "OperationalIncidentEvent"
ADD CONSTRAINT "OperationalIncidentEvent_incidentId_fkey"
FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
