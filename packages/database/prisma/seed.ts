import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@tchuno.local';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Admin',
      passwordHash: 'change-me',
      isActive: true,
    },
  });

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
  ];

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

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: adminEmail },
    select: { id: true },
  });

  const eletricidade = await prisma.category.findUnique({
    where: { slug: 'eletricidade' },
    select: { id: true },
  });

  if (eletricidade) {
    const profile = await prisma.workerProfile.upsert({
      where: { userId: admin.id },
      update: {
        bio: 'Tecnico de manutencao geral para pequenos servicos.',
        location: 'Maputo',
        hourlyRate: 800,
        experienceYears: 5,
        isAvailable: true,
      },
      create: {
        userId: admin.id,
        bio: 'Tecnico de manutencao geral para pequenos servicos.',
        location: 'Maputo',
        hourlyRate: 800,
        experienceYears: 5,
        isAvailable: true,
      },
    });

    await prisma.workerProfileCategory.upsert({
      where: {
        workerProfileId_categoryId: {
          workerProfileId: profile.id,
          categoryId: eletricidade.id,
        },
      },
      update: {},
      create: {
        workerProfileId: profile.id,
        categoryId: eletricidade.id,
      },
    });
  }

  console.log(
    `Seed completed: ${adminEmail} + ${defaultCategories.length} categories`,
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
