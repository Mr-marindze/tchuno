-- CreateEnum
CREATE TYPE "UserNotificationKind" AS ENUM (
    'REQUEST_INVITATION_RECEIVED',
    'REQUEST_INVITATION_DECLINED',
    'PROPOSAL_SUBMITTED',
    'PROPOSAL_SELECTED',
    'PROPOSAL_REJECTED',
    'JOB_MESSAGE_RECEIVED',
    'JOB_CANCELED',
    'REFUND_REQUESTED',
    'REFUND_STATUS_UPDATED'
);

-- CreateEnum
CREATE TYPE "UserNotificationTone" AS ENUM ('ATTENTION', 'SUCCESS', 'INFO', 'MUTED');

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "kind" "UserNotificationKind" NOT NULL,
    "tone" "UserNotificationTone" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "hrefLabel" TEXT,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMessage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "JobMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserNotification_userId_readAt_createdAt_idx" ON "UserNotification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "JobMessage_jobId_createdAt_idx" ON "JobMessage"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobMessage_recipientUserId_readAt_createdAt_idx" ON "JobMessage"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "JobMessage_senderUserId_createdAt_idx" ON "JobMessage"("senderUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserNotification"
ADD CONSTRAINT "UserNotification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage"
ADD CONSTRAINT "JobMessage_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
