-- CreateTable
CREATE TABLE "JobMessageAttachment" (
    "id" TEXT NOT NULL,
    "jobMessageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobMessageAttachment_jobMessageId_idx" ON "JobMessageAttachment"("jobMessageId");

-- AddForeignKey
ALTER TABLE "JobMessageAttachment"
ADD CONSTRAINT "JobMessageAttachment_jobMessageId_fkey"
FOREIGN KEY ("jobMessageId") REFERENCES "JobMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
