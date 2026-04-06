import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { ListWorkerProfilesQueryDto } from './dto/list-worker-profiles-query.dto';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { UpsertWorkerProfileDto } from './dto/upsert-worker-profile.dto';

const workerProfileInclude = {
  user: {
    select: {
      name: true,
    },
  },
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
    const { page, limit, skip } = resolvePagination(query);
    const sort = query.sort ?? 'updatedAt:desc';
    const normalizedSearch = query.search?.trim();

    const where: Prisma.WorkerProfileWhereInput = {
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
      ...(normalizedSearch
        ? {
            OR: [
              {
                publicName: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                user: {
                  is: {
                    name: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                },
              },
              {
                userId: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                location: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                categories: {
                  some: {
                    category: {
                      name: {
                        contains: normalizedSearch,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, profiles] = await this.prisma.$transaction([
      this.prisma.workerProfile.count({ where }),
      this.prisma.workerProfile.findMany({
        where,
        include: workerProfileInclude,
        orderBy: this.buildOrderBy(sort),
        take: limit,
        skip,
      }),
    ]);

    return buildPaginatedResponse({
      data: profiles.map((profile) => this.toDto(profile)),
      total,
      page,
      limit,
    });
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
          publicName: dto.publicName?.trim() || null,
          bio: dto.bio?.trim() || null,
          location: dto.location?.trim() || null,
          hourlyRate: dto.hourlyRate ?? null,
          experienceYears: dto.experienceYears ?? 0,
          isAvailable: dto.isAvailable ?? true,
        },
        update: {
          publicName: dto.publicName?.trim() || null,
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
          ...(dto.publicName !== undefined
            ? { publicName: dto.publicName.trim() || null }
            : {}),
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

  private buildOrderBy(
    sort: string,
  ): Prisma.WorkerProfileOrderByWithRelationInput[] {
    const [sortField, sortDirection] = sort.split(':') as [
      'updatedAt' | 'rating' | 'hourlyRate',
      Prisma.SortOrder,
    ];

    if (sortField === 'rating') {
      return [
        { ratingAvg: sortDirection },
        { ratingCount: 'desc' },
        { updatedAt: 'desc' },
        { id: 'desc' },
      ];
    }

    if (sortField === 'hourlyRate') {
      return [
        { hourlyRate: sortDirection },
        { updatedAt: 'desc' },
        { id: 'desc' },
      ];
    }

    return [{ updatedAt: sortDirection }, { id: 'desc' }];
  }

  private toDto(profile: WorkerProfileWithRelations) {
    const publicName = profile.publicName?.trim() || null;
    const accountName = profile.user.name?.trim() || null;
    const displayName = publicName ?? accountName;

    return {
      id: profile.id,
      userId: profile.userId,
      publicName,
      displayName,
      name: accountName,
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
