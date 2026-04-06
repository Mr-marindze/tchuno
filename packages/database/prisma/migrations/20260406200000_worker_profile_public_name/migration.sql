ALTER TABLE "WorkerProfile"
ADD COLUMN "publicName" TEXT;

UPDATE "WorkerProfile" AS wp
SET "publicName" = NULLIF(BTRIM(u."name"), '')
FROM "User" AS u
WHERE u."id" = wp."userId"
  AND wp."publicName" IS NULL;
