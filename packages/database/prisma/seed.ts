import { JobStatus, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'demo1234';

type SeedUserKey = 'admin' | 'clientA' | 'clientB' | 'workerA' | 'workerB';

const defaultCategories = [
  {
    name: 'Canalizacao',
    slug: 'canalizacao',
    description: 'Servicos de canalizacao e reparacoes de agua',
    sortOrder: 10,
  },
  {
    name: 'Eletricidade',
    slug: 'eletricidade',
    description: 'Instalacoes e manutencao eletrica residencial',
    sortOrder: 20,
  },
  {
    name: 'Pintura',
    slug: 'pintura',
    description: 'Pintura de interiores e exteriores',
    sortOrder: 30,
  },
  {
    name: 'Limpeza',
    slug: 'limpeza',
    description: 'Limpeza domestica e pos-obra',
    sortOrder: 40,
  },
];

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
    const upsertedUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        isActive: true,
      },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    users[key] = upsertedUser;
  }

  for (const category of defaultCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: category,
    });
  }

  const categoryRows = await prisma.category.findMany({
    where: {
      slug: {
        in: defaultCategories.map((category) => category.slug),
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
  const eletricidadeId = getCategoryId('eletricidade');
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
      bio: 'Especialista em eletricidade e pintura de interiores.',
      location: 'Maputo - Polana',
      hourlyRate: 1200,
      experienceYears: 6,
      isAvailable: true,
    },
    create: {
      userId: users.workerA.id,
      bio: 'Especialista em eletricidade e pintura de interiores.',
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
        categoryId: eletricidadeId,
      },
      {
        workerProfileId: workerAProfile.id,
        categoryId: eletricidadeId,
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

  await prisma.job.deleteMany({
    where: {
      clientId: {
        in: [users.clientA.id, users.clientB.id],
      },
    },
  });

  const now = Date.now();
  const completedJobA = await prisma.job.create({
    data: {
      clientId: users.clientA.id,
      workerProfileId: workerAProfile.id,
      categoryId: eletricidadeId,
      title: 'Troca de disjuntor principal',
      description: 'Disjuntor antigo com quedas frequentes de energia.',
      budget: 4500,
      status: JobStatus.COMPLETED,
      scheduledFor: new Date(now - 3 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    },
    select: { id: true, workerProfileId: true, clientId: true },
  });

  const completedJobB = await prisma.job.create({
    data: {
      clientId: users.clientB.id,
      workerProfileId: workerBProfile.id,
      categoryId: canalizacaoId,
      title: 'Reparar fuga na cozinha',
      description: 'Fuga pequena no tubo de entrada da banca.',
      budget: 3200,
      status: JobStatus.COMPLETED,
      scheduledFor: new Date(now - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
    },
    select: { id: true, workerProfileId: true, clientId: true },
  });

  await prisma.job.create({
    data: {
      clientId: users.clientB.id,
      workerProfileId: workerAProfile.id,
      categoryId: pinturaId,
      title: 'Pintura de quarto infantil',
      description: 'Pintura completa de quarto de 12m2 com duas cores.',
      budget: 7000,
      status: JobStatus.IN_PROGRESS,
      scheduledFor: new Date(now - 24 * 60 * 60 * 1000),
    },
  });

  await prisma.job.create({
    data: {
      clientId: users.clientA.id,
      workerProfileId: workerAProfile.id,
      categoryId: eletricidadeId,
      title: 'Instalar tomadas no escritorio',
      description: 'Adicionar 3 tomadas e revisar quadro eletrico.',
      budget: 3800,
      status: JobStatus.REQUESTED,
      scheduledFor: new Date(now + 2 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.job.create({
    data: {
      clientId: users.clientB.id,
      workerProfileId: workerBProfile.id,
      categoryId: canalizacaoId,
      title: 'Substituir torneira do quintal',
      description: 'Torneira com vazamento continuo no quintal.',
      budget: 2100,
      status: JobStatus.ACCEPTED,
      scheduledFor: new Date(now + 24 * 60 * 60 * 1000),
    },
  });

  await prisma.job.create({
    data: {
      clientId: users.clientA.id,
      workerProfileId: workerBProfile.id,
      categoryId: limpezaId,
      title: 'Limpeza pos-obra da sala',
      description: 'Limpeza profunda apos pequenas obras internas.',
      budget: 2900,
      status: JobStatus.CANCELED,
      scheduledFor: new Date(now - 2 * 24 * 60 * 60 * 1000),
      canceledAt: new Date(now - 30 * 60 * 1000),
    },
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

  console.log(`Seed completed with ${defaultCategories.length} categories.`);
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
