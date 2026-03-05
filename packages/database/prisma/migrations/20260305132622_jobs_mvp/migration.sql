-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budget" INTEGER NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'REQUESTED',
    "scheduledFor" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_clientId_status_createdAt_idx" ON "Job"("clientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_workerProfileId_status_createdAt_idx" ON "Job"("workerProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
