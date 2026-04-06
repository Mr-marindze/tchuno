-- CreateEnum
CREATE TYPE "RequestInvitationStatus" AS ENUM ('SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "RequestInvitation" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "status" "RequestInvitationStatus" NOT NULL DEFAULT 'SENT',
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequestInvitation_requestId_providerUserId_key" ON "RequestInvitation"("requestId", "providerUserId");

-- CreateIndex
CREATE INDEX "RequestInvitation_requestId_status_createdAt_idx" ON "RequestInvitation"("requestId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RequestInvitation_providerUserId_status_createdAt_idx" ON "RequestInvitation"("providerUserId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "RequestInvitation" ADD CONSTRAINT "RequestInvitation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestInvitation" ADD CONSTRAINT "RequestInvitation_providerUserId_fkey" FOREIGN KEY ("providerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
