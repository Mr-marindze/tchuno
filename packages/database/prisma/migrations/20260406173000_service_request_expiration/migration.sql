ALTER TABLE "ServiceRequest"
ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "ServiceRequest"
SET "expiresAt" = "createdAt" + INTERVAL '72 hours'
WHERE "expiresAt" IS NULL;

ALTER TABLE "ServiceRequest"
ALTER COLUMN "expiresAt" SET NOT NULL;

CREATE INDEX "ServiceRequest_status_expiresAt_idx"
ON "ServiceRequest"("status", "expiresAt");
