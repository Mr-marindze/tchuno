-- Create enums for user role and job pricing mode.
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "JobPricingMode" AS ENUM ('FIXED_PRICE', 'QUOTE_REQUEST');

-- User role for basic RBAC.
ALTER TABLE "User"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Job pricing/cancellation lifecycle metadata.
ALTER TABLE "Job"
ADD COLUMN "pricingMode" "JobPricingMode" NOT NULL DEFAULT 'FIXED_PRICE',
ADD COLUMN "quotedAmount" INTEGER,
ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "canceledBy" TEXT,
ADD COLUMN "cancelReason" TEXT;

ALTER TABLE "Job"
ALTER COLUMN "budget" DROP NOT NULL;

CREATE INDEX "Job_pricingMode_status_createdAt_idx"
ON "Job"("pricingMode", "status", "createdAt");
