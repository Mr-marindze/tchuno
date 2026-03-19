-- CreateTable
CREATE TABLE "TrackingWorkerAggregate" (
    "workerProfileId" TEXT NOT NULL,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctaClicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingWorkerAggregate_pkey" PRIMARY KEY ("workerProfileId")
);

-- CreateTable
CREATE TABLE "TrackingCategoryAggregate" (
    "categorySlug" TEXT NOT NULL,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingCategoryAggregate_pkey" PRIMARY KEY ("categorySlug")
);

-- CreateIndex
CREATE INDEX "TrackingWorkerAggregate_updatedAt_idx" ON "TrackingWorkerAggregate"("updatedAt");

-- CreateIndex
CREATE INDEX "TrackingWorkerAggregate_conversions_ctaClicks_clicks_idx" ON "TrackingWorkerAggregate"("conversions", "ctaClicks", "clicks");

-- CreateIndex
CREATE INDEX "TrackingCategoryAggregate_updatedAt_idx" ON "TrackingCategoryAggregate"("updatedAt");

-- CreateIndex
CREATE INDEX "TrackingCategoryAggregate_interactions_idx" ON "TrackingCategoryAggregate"("interactions");
