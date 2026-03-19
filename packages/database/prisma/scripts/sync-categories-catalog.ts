import { PrismaClient } from '@prisma/client';
import { syncOfficialCategories } from '../catalog/sync-official-categories';

const prisma = new PrismaClient();

async function main() {
  const summary = await syncOfficialCategories(prisma);

  console.log(
    `Official categories upserted: ${summary.upsertedOfficialCount}.`,
  );
  console.log(
    `Legacy merges: ${summary.mergedLegacyCount}, worker links reassigned: ${summary.reassignedWorkerLinks}, jobs reassigned: ${summary.reassignedJobs}, tracking merged: ${summary.mergedTrackingRows}.`,
  );
  console.log(`Legacy categories deactivated: ${summary.deactivatedLegacyCount}.`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Category sync failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
