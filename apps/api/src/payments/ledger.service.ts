import { Injectable } from '@nestjs/common';
import {
  LedgerBalanceBucket,
  LedgerDirection,
  Prisma,
  PrismaClient,
} from '@prisma/client';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class LedgerService {
  async appendEntries(
    prisma: PrismaLike,
    entries: Prisma.LedgerEntryCreateManyInput[],
  ) {
    if (entries.length === 0) {
      return;
    }

    await prisma.ledgerEntry.createMany({
      data: entries,
    });
  }

  async computeBucketNet(
    prisma: PrismaLike,
    input: {
      bucket: LedgerBalanceBucket;
      where?: Prisma.LedgerEntryWhereInput;
    },
  ): Promise<number> {
    const rows = await prisma.ledgerEntry.groupBy({
      by: ['direction'],
      where: {
        balanceBucket: input.bucket,
        ...(input.where ?? {}),
      },
      _sum: {
        amount: true,
      },
    });

    return rows.reduce((acc, row) => {
      const amount = row._sum.amount ?? 0;
      if (row.direction === LedgerDirection.CREDIT) {
        return acc + amount;
      }

      return acc - amount;
    }, 0);
  }
}
