-- CreateEnum
CREATE TYPE "OperationalIncidentSource" AS ENUM (
  'SUPPORT',
  'REFUND_DISPUTE',
  'TRUST_SAFETY',
  'PLATFORM'
);

-- CreateEnum
CREATE TYPE "OperationalIncidentSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

-- CreateEnum
CREATE TYPE "OperationalIncidentStatus" AS ENUM (
  'OPEN',
  'INVESTIGATING',
  'MITIGATING',
  'MONITORING',
  'RESOLVED',
  'CANCELED'
);

-- AlterTable
ALTER TABLE "RefundRequest"
ADD COLUMN "decisionNote" TEXT,
ADD COLUMN "evidenceItems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "OperationalIncident" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "source" "OperationalIncidentSource" NOT NULL DEFAULT 'SUPPORT',
  "severity" "OperationalIncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "OperationalIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "impactedArea" TEXT,
  "customerImpact" TEXT,
  "evidenceItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "resolutionNote" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "ownerAdminUserId" TEXT,
  "relatedJobId" TEXT,
  "relatedRefundRequestId" TEXT,
  "relatedTrustSafetyInterventionId" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalIncident_status_severity_detectedAt_idx"
ON "OperationalIncident"("status", "severity", "detectedAt");

-- CreateIndex
CREATE INDEX "OperationalIncident_source_status_detectedAt_idx"
ON "OperationalIncident"("source", "status", "detectedAt");

-- CreateIndex
CREATE INDEX "OperationalIncident_ownerAdminUserId_status_updatedAt_idx"
ON "OperationalIncident"("ownerAdminUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "OperationalIncident_relatedJobId_createdAt_idx"
ON "OperationalIncident"("relatedJobId", "createdAt");

-- AddForeignKey
ALTER TABLE "OperationalIncident"
ADD CONSTRAINT "OperationalIncident_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalIncident"
ADD CONSTRAINT "OperationalIncident_ownerAdminUserId_fkey"
FOREIGN KEY ("ownerAdminUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalIncident"
ADD CONSTRAINT "OperationalIncident_relatedJobId_fkey"
FOREIGN KEY ("relatedJobId") REFERENCES "Job"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalIncident"
ADD CONSTRAINT "OperationalIncident_relatedRefundRequestId_fkey"
FOREIGN KEY ("relatedRefundRequestId") REFERENCES "RefundRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalIncident"
ADD CONSTRAINT "OperationalIncident_relatedTrustSafetyInterventionId_fkey"
FOREIGN KEY ("relatedTrustSafetyInterventionId") REFERENCES "TrustSafetyIntervention"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
