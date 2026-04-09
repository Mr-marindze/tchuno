-- AlterEnum
ALTER TYPE "UserNotificationKind" ADD VALUE IF NOT EXISTS 'TRUST_SAFETY_UPDATE';

-- CreateEnum
CREATE TYPE "TrustSafetyRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TrustSafetyInterventionAction" AS ENUM ('WARNING', 'TEMP_BLOCK');

-- CreateEnum
CREATE TYPE "TrustSafetyInterventionStatus" AS ENUM (
    'LOGGED',
    'OPEN',
    'APPEALED',
    'CLEARED',
    'ENFORCED'
);

-- CreateTable
CREATE TABLE "TrustSafetyIntervention" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "counterpartUserId" TEXT NOT NULL,
    "riskLevel" "TrustSafetyRiskLevel" NOT NULL,
    "action" "TrustSafetyInterventionAction" NOT NULL,
    "status" "TrustSafetyInterventionStatus" NOT NULL DEFAULT 'OPEN',
    "reasonSummary" TEXT NOT NULL,
    "messagePreview" TEXT NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "appealRequestedAt" TIMESTAMP(3),
    "appealReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustSafetyIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustSafetyIntervention_jobId_createdAt_idx" ON "TrustSafetyIntervention"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustSafetyIntervention_actorUserId_createdAt_idx" ON "TrustSafetyIntervention"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustSafetyIntervention_status_riskLevel_createdAt_idx" ON "TrustSafetyIntervention"("status", "riskLevel", "createdAt");

-- AddForeignKey
ALTER TABLE "TrustSafetyIntervention"
ADD CONSTRAINT "TrustSafetyIntervention_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustSafetyIntervention"
ADD CONSTRAINT "TrustSafetyIntervention_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustSafetyIntervention"
ADD CONSTRAINT "TrustSafetyIntervention_counterpartUserId_fkey"
FOREIGN KEY ("counterpartUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustSafetyIntervention"
ADD CONSTRAINT "TrustSafetyIntervention_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
