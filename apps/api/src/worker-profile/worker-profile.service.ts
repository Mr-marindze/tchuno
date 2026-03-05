import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListWorkerProfilesQueryDto } from './dto/list-worker-profiles-query.dto';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { UpsertWorkerProfileDto } from './dto/upsert-worker-profile.dto';

const workerProfileInclude = {
  categories: {
    include: {
      category: true,
    },
  },
} satisfies Prisma.WorkerProfileInclude;

type WorkerProfileWithRelations = Prisma.WorkerProfileGetPayload<{
  include: typeof workerProfileInclude;
}>;

@Injectable()
export class WorkerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListWorkerProfilesQueryDto) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const profiles = await this.prisma.workerProfile.findMany({
      where: {
        ...(query.isAvailable !== undefined
          ? { isAvailable: query.isAvailable }
          : {}),
        ...(query.categorySlug
          ? {
              categories: {
                some: {
                  category: {
                    slug: query.categorySlug,
                    isActive: true,
                  },
                },
              },
            }
          : {}),
      },
      include: workerProfileInclude,
      orderBy: [{ isAvailable: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      skip: offset,
    });

    return profiles.map((profile) => this.toDto(profile));
  }

  async getPublicByUserId(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      include: workerProfileInclude,
    });

    if (!profile) {
      throw new NotFoundException('Worker profile not found');
    }

    return this.toDto(profile);
  }

  async getMe(userId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      include: workerProfileInclude,
    });

    if (!profile) {
      throw new NotFoundException('Worker profile not found');
    }

    return this.toDto(profile);
  }

  async upsertMe(userId: string, dto: UpsertWorkerProfileDto) {
    if (dto.categoryIds) {
      await this.ensureCategoriesExist(dto.categoryIds);
    }

    const profile = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.workerProfile.upsert({
        where: { userId },
        create: {
          userId,
          bio: dto.bio?.trim() || null,
          location: dto.location?.trim() || null,
          hourlyRate: dto.hourlyRate ?? null,
          experienceYears: dto.experienceYears ?? 0,
          isAvailable: dto.isAvailable ?? true,
        },
        update: {
          bio: dto.bio?.trim() || null,
          location: dto.location?.trim() || null,
          hourlyRate: dto.hourlyRate ?? null,
          experienceYears: dto.experienceYears ?? 0,
          isAvailable: dto.isAvailable ?? true,
        },
      });

      if (dto.categoryIds) {
        await tx.workerProfileCategory.deleteMany({
          where: { workerProfileId: upserted.id },
        });

        if (dto.categoryIds.length > 0) {
          await tx.workerProfileCategory.createMany({
            data: dto.categoryIds.map((categoryId) => ({
              workerProfileId: upserted.id,
              categoryId,
            })),
          });
        }
      }

      return tx.workerProfile.findUniqueOrThrow({
        where: { id: upserted.id },
        include: workerProfileInclude,
      });
    });

    return this.toDto(profile);
  }

  async updateMe(userId: string, dto: UpdateWorkerProfileDto) {
    const existing = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Worker profile not found');
    }

    if (dto.categoryIds) {
      await this.ensureCategoriesExist(dto.categoryIds);
    }

    const profile = await this.prisma.$transaction(async (tx) => {
      await tx.workerProfile.update({
        where: { userId },
        data: {
          ...(dto.bio !== undefined ? { bio: dto.bio.trim() || null } : {}),
          ...(dto.location !== undefined
            ? { location: dto.location.trim() || null }
            : {}),
          ...(dto.hourlyRate !== undefined
            ? { hourlyRate: dto.hourlyRate }
            : {}),
          ...(dto.experienceYears !== undefined
            ? { experienceYears: dto.experienceYears }
            : {}),
          ...(dto.isAvailable !== undefined
            ? { isAvailable: dto.isAvailable }
            : {}),
        },
      });

      if (dto.categoryIds) {
        await tx.workerProfileCategory.deleteMany({
          where: { workerProfileId: existing.id },
        });

        if (dto.categoryIds.length > 0) {
          await tx.workerProfileCategory.createMany({
            data: dto.categoryIds.map((categoryId) => ({
              workerProfileId: existing.id,
              categoryId,
            })),
          });
        }
      }

      return tx.workerProfile.findUniqueOrThrow({
        where: { id: existing.id },
        include: workerProfileInclude,
      });
    });

    return this.toDto(profile);
  }

  private async ensureCategoriesExist(categoryIds: string[]) {
    if (categoryIds.length === 0) {
      return;
    }

    const categories = await this.prisma.category.findMany({
      where: {
        id: { in: categoryIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (categories.length !== categoryIds.length) {
      throw new ConflictException(
        'One or more categories are invalid or inactive',
      );
    }
  }

  private toDto(profile: WorkerProfileWithRelations) {
    return {
      id: profile.id,
      userId: profile.userId,
      bio: profile.bio,
      location: profile.location,
      hourlyRate: profile.hourlyRate,
      experienceYears: profile.experienceYears,
      isAvailable: profile.isAvailable,
      ratingAvg: profile.ratingAvg.toString(),
      ratingCount: profile.ratingCount,
      categories: profile.categories
        .map((item) => ({
          id: item.category.id,
          name: item.category.name,
          slug: item.category.slug,
          sortOrder: item.category.sortOrder,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ id, name, slug }) => ({ id, name, slug })),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
