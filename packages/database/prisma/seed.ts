import { JobStatus, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { officialCategories } from './catalog/official-categories';
import { syncOfficialCategories } from './catalog/sync-official-categories';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'demo1234';

type SeedUserKey = 'admin' | 'clientA' | 'clientB' | 'workerA' | 'workerB';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const seedUsers: Record<
    SeedUserKey,
    {
      email: string;
      name: string;
    }
  > = {
    admin: {
      email: 'admin@tchuno.local',
      name: 'Admin Tchuno',
    },
    clientA: {
      email: 'client1@tchuno.local',
      name: 'Cliente Demo 1',
    },
    clientB: {
      email: 'client2@tchuno.local',
      name: 'Cliente Demo 2',
    },
    workerA: {
      email: 'worker1@tchuno.local',
      name: 'Mateus Eletricista',
    },
    workerB: {
      email: 'worker2@tchuno.local',
      name: 'Joana Canalizadora',
    },
  };

  const users = {} as Record<SeedUserKey, { id: string; email: string }>;

  for (const [key, user] of Object.entries(seedUsers) as Array<
    [SeedUserKey, { email: string; name: string }]
  >) {
    const role = key === 'admin' ? 'ADMIN' : 'USER';

    const upsertedUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role,
        isActive: true,
      },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    users[key] = upsertedUser;
  }

  const categoriesSync = await syncOfficialCategories(prisma);

  const categoryRows = await prisma.category.findMany({
    where: {
      slug: {
        in: officialCategories.map((category) => category.slug),
      },
    },
    select: {
      id: true,
      slug: true,
    },
  });

  const categoriesBySlug = categoryRows.reduce<Record<string, string>>(
    (acc, category) => {
      acc[category.slug] = category.id;
      return acc;
    },
    {},
  );

  const getCategoryId = (slug: string) => {
    const categoryId = categoriesBySlug[slug];
    if (!categoryId) {
      throw new Error(`Missing required category in seed: ${slug}`);
    }

    return categoryId;
  };

  const canalizacaoId = getCategoryId('canalizacao');
  const eletricistaId = getCategoryId('eletricista');
  const pinturaId = getCategoryId('pintura');
  const limpezaId = getCategoryId('limpeza');

  const adminProfile = await prisma.workerProfile.upsert({
    where: { userId: users.admin.id },
    update: {
      bio: 'Tecnico geral para manutencao residencial.',
      location: 'Maputo Centro',
      hourlyRate: 1000,
      experienceYears: 7,
      isAvailable: true,
    },
    create: {
      userId: users.admin.id,
      bio: 'Tecnico geral para manutencao residencial.',
      location: 'Maputo Centro',
      hourlyRate: 1000,
      experienceYears: 7,
      isAvailable: true,
    },
    select: { id: true },
  });

  const workerAProfile = await prisma.workerProfile.upsert({
    where: { userId: users.workerA.id },
    update: {
      bio: 'Especialista em serviços elétricos e pintura de interiores.',
      location: 'Maputo - Polana',
      hourlyRate: 1200,
      experienceYears: 6,
      isAvailable: true,
    },
    create: {
      userId: users.workerA.id,
      bio: 'Especialista em serviços elétricos e pintura de interiores.',
      location: 'Maputo - Polana',
      hourlyRate: 1200,
      experienceYears: 6,
      isAvailable: true,
    },
    select: { id: true },
  });

  const workerBProfile = await prisma.workerProfile.upsert({
    where: { userId: users.workerB.id },
    update: {
      bio: 'Canalizadora com foco em reparacoes rapidas e instalacoes.',
      location: 'Matola - Machava',
      hourlyRate: 950,
      experienceYears: 4,
      isAvailable: false,
    },
    create: {
      userId: users.workerB.id,
      bio: 'Canalizadora com foco em reparacoes rapidas e instalacoes.',
      location: 'Matola - Machava',
      hourlyRate: 950,
      experienceYears: 4,
      isAvailable: false,
    },
    select: { id: true },
  });

  await prisma.workerProfileCategory.deleteMany({
    where: {
      workerProfileId: {
        in: [adminProfile.id, workerAProfile.id, workerBProfile.id],
      },
    },
  });

  await prisma.workerProfileCategory.createMany({
    data: [
      {
        workerProfileId: adminProfile.id,
        categoryId: eletricistaId,
      },
      {
        workerProfileId: workerAProfile.id,
        categoryId: eletricistaId,
      },
      {
        workerProfileId: workerAProfile.id,
        categoryId: pinturaId,
      },
      {
        workerProfileId: workerBProfile.id,
        categoryId: canalizacaoId,
      },
      {
        workerProfileId: workerBProfile.id,
        categoryId: limpezaId,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.review.deleteMany({
    where: {
      reviewerId: {
        in: [users.clientA.id, users.clientB.id],
      },
    },
  });

  await prisma.job.deleteMany({
    where: {
      clientId: {
        in: [users.clientA.id, users.clientB.id],
      },
    },
  });

  await prisma.serviceRequest.deleteMany({
    where: {
      customerId: {
        in: [users.clientA.id, users.clientB.id],
      },
    },
  });

  const now = Date.now();

  async function createServiceRequestBackedJob(input: {
    customerId: string;
    providerId: string;
    workerProfileId: string;
    categoryId: string;
    title: string;
    description: string;
    location: string;
    agreedPrice: number;
    proposalComment: string;
    status: JobStatus;
    scheduledFor: Date;
    acceptedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    canceledAt?: Date;
    canceledBy?: string;
    cancelReason?: string;
    paymentStatus: 'AWAITING_PAYMENT' | 'PAID_PARTIAL';
  }) {
    const request = await prisma.serviceRequest.create({
      data: {
        customerId: input.customerId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        location: input.location,
        status: 'OPEN',
      },
      select: {
        id: true,
      },
    });

    const proposal = await prisma.proposal.create({
      data: {
        requestId: request.id,
        providerId: input.providerId,
        price: input.agreedPrice,
        comment: input.proposalComment,
        status: 'SELECTED',
      },
      select: {
        id: true,
      },
    });

    await prisma.serviceRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: 'CLOSED',
        selectedProposalId: proposal.id,
      },
    });

    const contactUnlockedAt =
      input.paymentStatus === 'PAID_PARTIAL' ? new Date(now - 60 * 60 * 1000) : null;

    const job = await prisma.job.create({
      data: {
        requestId: request.id,
        proposalId: proposal.id,
        clientId: input.customerId,
        customerId: input.customerId,
        providerId: input.providerId,
        workerProfileId: input.workerProfileId,
        categoryId: input.categoryId,
        agreedPrice: input.agreedPrice,
        pricingMode: 'FIXED_PRICE',
        title: input.title,
        description: input.description,
        budget: input.agreedPrice,
        quotedAmount: input.agreedPrice,
        quoteMessage: input.proposalComment,
        status: input.status,
        scheduledFor: input.scheduledFor,
        acceptedAt: input.acceptedAt,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        canceledAt: input.canceledAt,
        canceledBy: input.canceledBy,
        cancelReason: input.cancelReason,
        contactUnlockedAt,
      },
      select: {
        id: true,
        workerProfileId: true,
        clientId: true,
      },
    });

    const depositAmount = Math.max(1, Math.round((input.agreedPrice * 30) / 100));
    const platformFeeAmount = Math.min(
      depositAmount,
      Math.round((depositAmount * 1500) / 10_000),
    );
    const providerNetAmount = Math.max(0, depositAmount - platformFeeAmount);

    const paymentIntent = await prisma.paymentIntent.create({
      data: {
        jobId: job.id,
        customerId: input.customerId,
        providerUserId: input.providerId,
        amount: depositAmount,
        currency: 'MZN',
        platformFeeAmount,
        providerNetAmount,
        status: input.paymentStatus,
        provider: 'INTERNAL',
        acceptedQuoteSnapshot: input.agreedPrice,
        metadata: {
          kind: 'deposit',
          agreedPrice: input.agreedPrice,
          depositPercent: 30,
          serviceRequestId: request.id,
          proposalId: proposal.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (input.paymentStatus === 'PAID_PARTIAL') {
      await prisma.ledgerEntry.createMany({
        data: [
          {
            jobId: job.id,
            paymentIntentId: paymentIntent.id,
            actorType: 'CUSTOMER',
            entryType: 'CUSTOMER_CHARGE',
            amount: depositAmount,
            currency: 'MZN',
            direction: 'DEBIT',
            balanceBucket: 'CUSTOMER_EXTERNAL',
            description: 'Seed customer charge',
          },
          {
            jobId: job.id,
            paymentIntentId: paymentIntent.id,
            actorType: 'PLATFORM',
            entryType: 'PLATFORM_FEE_RESERVED',
            amount: platformFeeAmount,
            currency: 'MZN',
            direction: 'CREDIT',
            balanceBucket: 'PLATFORM_RESERVED',
            description: 'Seed platform fee reserved',
          },
          {
            jobId: job.id,
            paymentIntentId: paymentIntent.id,
            actorType: 'PROVIDER',
            entryType: 'PROVIDER_BALANCE_HELD',
            amount: providerNetAmount,
            currency: 'MZN',
            direction: 'CREDIT',
            balanceBucket: 'PROVIDER_HELD',
            description: 'Seed provider held balance',
          },
        ],
      });
    }

    return job;
  }

  const completedJobA = await createServiceRequestBackedJob({
    customerId: users.clientA.id,
    providerId: users.workerA.id,
    workerProfileId: workerAProfile.id,
    categoryId: eletricistaId,
    title: 'Troca de disjuntor principal',
    description: 'Disjuntor antigo com quedas frequentes de energia.',
    location: 'Maputo - Polana',
    agreedPrice: 4500,
    proposalComment: 'Inclui visita técnica e substituição do disjuntor.',
    status: JobStatus.COMPLETED,
    scheduledFor: new Date(now - 3 * 24 * 60 * 60 * 1000),
    acceptedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    startedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
    completedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    paymentStatus: 'PAID_PARTIAL',
  });

  const completedJobB = await createServiceRequestBackedJob({
    customerId: users.clientB.id,
    providerId: users.workerB.id,
    workerProfileId: workerBProfile.id,
    categoryId: canalizacaoId,
    title: 'Reparar fuga na cozinha',
    description: 'Fuga pequena no tubo de entrada da banca.',
    location: 'Matola - Machava',
    agreedPrice: 3200,
    proposalComment: 'Inclui reparação e teste de pressão.',
    status: JobStatus.COMPLETED,
    scheduledFor: new Date(now - 5 * 24 * 60 * 60 * 1000),
    acceptedAt: new Date(now - 5 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
    startedAt: new Date(now - 5 * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000),
    completedAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
    paymentStatus: 'PAID_PARTIAL',
  });

  await createServiceRequestBackedJob({
    customerId: users.clientB.id,
    providerId: users.workerA.id,
    workerProfileId: workerAProfile.id,
    categoryId: pinturaId,
    title: 'Pintura de quarto infantil',
    description: 'Pintura completa de quarto de 12m2 com duas cores.',
    location: 'Maputo',
    agreedPrice: 7000,
    proposalComment: 'Inclui tinta e preparação da parede.',
    status: JobStatus.IN_PROGRESS,
    scheduledFor: new Date(now - 24 * 60 * 60 * 1000),
    acceptedAt: new Date(now - 20 * 60 * 60 * 1000),
    startedAt: new Date(now - 18 * 60 * 60 * 1000),
    paymentStatus: 'PAID_PARTIAL',
  });

  await createServiceRequestBackedJob({
    customerId: users.clientA.id,
    providerId: users.workerA.id,
    workerProfileId: workerAProfile.id,
    categoryId: eletricistaId,
    title: 'Instalar tomadas no escritorio',
    description: 'Adicionar 3 tomadas e revisar quadro eletrico.',
    location: 'Maputo Centro',
    agreedPrice: 3800,
    proposalComment: 'Inclui material e instalação.',
    status: JobStatus.REQUESTED,
    scheduledFor: new Date(now + 2 * 24 * 60 * 60 * 1000),
    paymentStatus: 'AWAITING_PAYMENT',
  });

  await createServiceRequestBackedJob({
    customerId: users.clientB.id,
    providerId: users.workerB.id,
    workerProfileId: workerBProfile.id,
    categoryId: canalizacaoId,
    title: 'Substituir torneira do quintal',
    description: 'Torneira com vazamento continuo no quintal.',
    location: 'Matola',
    agreedPrice: 2100,
    proposalComment: 'Troca completa da torneira com vedação nova.',
    status: JobStatus.ACCEPTED,
    scheduledFor: new Date(now + 24 * 60 * 60 * 1000),
    acceptedAt: new Date(now - 4 * 60 * 60 * 1000),
    paymentStatus: 'PAID_PARTIAL',
  });

  await createServiceRequestBackedJob({
    customerId: users.clientA.id,
    providerId: users.workerB.id,
    workerProfileId: workerBProfile.id,
    categoryId: limpezaId,
    title: 'Limpeza pos-obra da sala',
    description: 'Limpeza profunda apos pequenas obras internas.',
    location: 'Maputo',
    agreedPrice: 2900,
    proposalComment: 'Equipe com materiais de limpeza incluídos.',
    status: JobStatus.CANCELED,
    scheduledFor: new Date(now - 2 * 24 * 60 * 60 * 1000),
    canceledAt: new Date(now - 30 * 60 * 1000),
    canceledBy: users.clientA.id,
    cancelReason: 'Mudança de plano do cliente',
    paymentStatus: 'AWAITING_PAYMENT',
  });

  await prisma.review.create({
    data: {
      jobId: completedJobA.id,
      workerProfileId: completedJobA.workerProfileId,
      reviewerId: completedJobA.clientId,
      rating: 5,
      comment: 'Servico excelente, rapido e muito profissional.',
    },
  });

  await prisma.review.create({
    data: {
      jobId: completedJobB.id,
      workerProfileId: completedJobB.workerProfileId,
      reviewerId: completedJobB.clientId,
      rating: 4,
      comment: 'Resolveu o problema com boa comunicacao.',
    },
  });

  for (const workerProfileId of [
    adminProfile.id,
    workerAProfile.id,
    workerBProfile.id,
  ]) {
    const aggregate = await prisma.review.aggregate({
      where: { workerProfileId },
      _avg: { rating: true },
      _count: { _all: true },
    });

    const ratingAvg = aggregate._avg.rating
      ? Number(aggregate._avg.rating)
      : 0;

    await prisma.workerProfile.update({
      where: { id: workerProfileId },
      data: {
        ratingAvg: ratingAvg.toFixed(2),
        ratingCount: aggregate._count._all,
      },
    });
  }

  console.log(
    `Seed completed with ${categoriesSync.upsertedOfficialCount} official categories.`,
  );
  if (categoriesSync.mergedLegacyCount > 0) {
    console.log(
      `Legacy categories merged: ${categoriesSync.mergedLegacyCount} (worker links reassigned: ${categoriesSync.reassignedWorkerLinks}, jobs reassigned: ${categoriesSync.reassignedJobs}).`,
    );
  }
  console.log(`Demo password for seeded users: ${DEMO_PASSWORD}`);
  console.log(
    'Seeded users: admin@tchuno.local, client1@tchuno.local, client2@tchuno.local, worker1@tchuno.local, worker2@tchuno.local',
  );
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
