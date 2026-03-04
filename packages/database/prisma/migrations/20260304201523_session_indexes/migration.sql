-- DropIndex
DROP INDEX "Session_lastUsedAt_idx";

-- DropIndex
DROP INDEX "Session_revokedAt_idx";

-- DropIndex
DROP INDEX "Session_userId_idx";

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Session_userId_lastUsedAt_idx" ON "Session"("userId", "lastUsedAt");

