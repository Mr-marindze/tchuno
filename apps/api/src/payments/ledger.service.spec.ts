import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  it('does not call createMany when entry list is empty', async () => {
    const createMany = jest.fn();
    const prisma = {
      ledgerEntry: {
        createMany,
      },
    };

    const service = new LedgerService();
    await service.appendEntries(prisma as never, []);

    expect(createMany).not.toHaveBeenCalled();
  });

  it('computes bucket net as credits minus debits', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      {
        direction: 'CREDIT',
        _sum: {
          amount: 1200,
        },
      },
      {
        direction: 'DEBIT',
        _sum: {
          amount: 450,
        },
      },
    ]);

    const prisma = {
      ledgerEntry: {
        groupBy,
      },
    };

    const service = new LedgerService();
    const net = await service.computeBucketNet(prisma as never, {
      bucket: 'PROVIDER_AVAILABLE',
      where: {
        actorType: 'PROVIDER',
      },
    });

    expect(groupBy).toHaveBeenCalledWith({
      by: ['direction'],
      where: {
        balanceBucket: 'PROVIDER_AVAILABLE',
        actorType: 'PROVIDER',
      },
      _sum: {
        amount: true,
      },
    });
    expect(net).toBe(750);
  });
});
