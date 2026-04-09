CREATE TYPE "WorkerAvailabilityStatus" AS ENUM (
  'AVAILABLE_NOW',
  'LIMITED_THIS_WEEK',
  'NEXT_WEEK',
  'UNAVAILABLE'
);

ALTER TABLE "WorkerProfile"
ADD COLUMN "serviceAreaPreferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "availabilityStatus" "WorkerAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE_NOW';

UPDATE "WorkerProfile"
SET "availabilityStatus" = CASE
  WHEN "isAvailable" = true THEN 'AVAILABLE_NOW'::"WorkerAvailabilityStatus"
  ELSE 'UNAVAILABLE'::"WorkerAvailabilityStatus"
END;
