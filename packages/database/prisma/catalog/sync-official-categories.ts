import { PrismaClient } from '@prisma/client';
import {
  legacyCategoryMappings,
  officialCategories,
} from './official-categories';

export type CategoriesSyncSummary = {
  upsertedOfficialCount: number;
  mergedLegacyCount: number;
  reassignedWorkerLinks: number;
  reassignedJobs: number;
  mergedTrackingRows: number;
  deactivatedLegacyCount: number;
};

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return a > b ? a : b;
}

export async function syncOfficialCategories(
  prisma: PrismaClient,
): Promise<CategoriesSyncSummary> {
  for (const category of officialCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
      },
    });
  }

  let mergedLegacyCount = 0;
  let reassignedWorkerLinks = 0;
  let reassignedJobs = 0;
  let mergedTrackingRows = 0;
  let deactivatedLegacyCount = 0;

  for (const mapping of legacyCategoryMappings) {
    const legacy = await prisma.category.findUnique({
      where: { slug: mapping.fromSlug },
      select: { id: true, slug: true, name: true, isActive: true },
    });

    if (!legacy) {
      continue;
    }

    const canonical = await prisma.category.findUnique({
      where: { slug: mapping.toSlug },
      select: { id: true, slug: true, name: true },
    });

    if (!canonical) {
      throw new Error(
        `Canonical category missing for mapping ${mapping.fromSlug} -> ${mapping.toSlug}`,
      );
    }

    if (legacy.id === canonical.id) {
      continue;
    }

    const migrationResult = await prisma.$transaction(async (tx) => {
      const legacyLinks = await tx.workerProfileCategory.findMany({
        where: { categoryId: legacy.id },
        select: { workerProfileId: true },
      });

      if (legacyLinks.length > 0) {
        await tx.workerProfileCategory.createMany({
          data: legacyLinks.map((link) => ({
            workerProfileId: link.workerProfileId,
            categoryId: canonical.id,
          })),
          skipDuplicates: true,
        });
      }

      const deletedLinks = await tx.workerProfileCategory.deleteMany({
        where: { categoryId: legacy.id },
      });

      const movedJobs = await tx.job.updateMany({
        where: { categoryId: legacy.id },
        data: { categoryId: canonical.id },
      });

      const legacyTracking = await tx.trackingCategoryAggregate.findUnique({
        where: { categorySlug: mapping.fromSlug },
      });
      const canonicalTracking = await tx.trackingCategoryAggregate.findUnique({
        where: { categorySlug: mapping.toSlug },
      });

      let mergedTracking = 0;

      if (legacyTracking) {
        if (canonicalTracking) {
          await tx.trackingCategoryAggregate.update({
            where: { categorySlug: mapping.toSlug },
            data: {
              interactions:
                canonicalTracking.interactions + legacyTracking.interactions,
              lastEventAt: maxDate(
                canonicalTracking.lastEventAt,
                legacyTracking.lastEventAt,
              ),
            },
          });
        } else {
          await tx.trackingCategoryAggregate.create({
            data: {
              categorySlug: mapping.toSlug,
              interactions: legacyTracking.interactions,
              lastEventAt: legacyTracking.lastEventAt,
            },
          });
        }

        await tx.trackingCategoryAggregate.delete({
          where: { categorySlug: mapping.fromSlug },
        });
        mergedTracking = 1;
      }

      let deactivatedLegacyId: string | null = null;
      if (legacy.isActive) {
        const deactivatedLegacy = await tx.category.update({
          where: { id: legacy.id },
          data: {
            isActive: false,
            sortOrder: 9999,
            description: `Categoria legada consolidada em "${canonical.name}" (${canonical.slug}).`,
          },
        });
        deactivatedLegacyId = deactivatedLegacy.id;
      }

      return {
        deletedLinks: deletedLinks.count,
        movedJobs: movedJobs.count,
        mergedTracking,
        deactivatedLegacyId,
      };
    });

    if (
      migrationResult.deletedLinks > 0 ||
      migrationResult.movedJobs > 0 ||
      migrationResult.mergedTracking > 0 ||
      migrationResult.deactivatedLegacyId
    ) {
      mergedLegacyCount += 1;
    }
    reassignedWorkerLinks += migrationResult.deletedLinks;
    reassignedJobs += migrationResult.movedJobs;
    mergedTrackingRows += migrationResult.mergedTracking;
    if (migrationResult.deactivatedLegacyId) {
      deactivatedLegacyCount += 1;
    }
  }

  return {
    upsertedOfficialCount: officialCategories.length,
    mergedLegacyCount,
    reassignedWorkerLinks,
    reassignedJobs,
    mergedTrackingRows,
    deactivatedLegacyCount,
  };
}
