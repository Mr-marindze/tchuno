import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminSubrole,
  JobPricingMode,
  JobStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { SecurityAuditService } from '../auth/security-audit.service';
import { AppRole } from '../auth/authorization.types';
import { PrismaService } from '../prisma/prisma.service';

const RECENT_JOBS_LIMIT = 8;

const adminOpsJobSelect = {
  id: true,
  title: true,
  status: true,
  pricingMode: true,
  clientId: true,
  workerProfileId: true,
  budget: true,
  quotedAmount: true,
  cancelReason: true,
  createdAt: true,
  acceptedAt: true,
  startedAt: true,
  completedAt: true,
  canceledAt: true,
  review: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.JobSelect;

type AdminOpsJobRecord = Prisma.JobGetPayload<{
  select: typeof adminOpsJobSelect;
}>;

type StatusSummary = Record<JobStatus, number>;
type PricingModeSummary = Record<JobPricingMode, number>;

const statusOrder: JobStatus[] = [
  'REQUESTED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELED',
];

const pricingModeOrder: JobPricingMode[] = ['FIXED_PRICE', 'QUOTE_REQUEST'];

@Injectable()
export class AdminOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async getOverview() {
    const [
      totalJobs,
      jobsByStatusRows,
      jobsByPricingModeRows,
      totalReviews,
      reviewsAggregate,
      activePublicableWorkers,
      recentJobs,
      recentlyCanceledJobs,
      completedWithoutReviewJobs,
    ] = await this.prisma.$transaction([
      this.prisma.job.count(),
      this.prisma.job.groupBy({
        by: ['status'],
        orderBy: {
          status: 'asc',
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.job.groupBy({
        by: ['pricingMode'],
        orderBy: {
          pricingMode: 'asc',
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.review.count(),
      this.prisma.review.aggregate({
        _avg: {
          rating: true,
        },
      }),
      this.prisma.workerProfile.count({
        where: {
          isAvailable: true,
          hourlyRate: {
            gt: 0,
          },
          experienceYears: {
            gt: 0,
          },
          location: {
            not: null,
          },
          user: {
            isActive: true,
          },
          categories: {
            some: {
              category: {
                isActive: true,
              },
            },
          },
          NOT: [
            {
              location: '',
            },
          ],
        },
      }),
      this.prisma.job.findMany({
        select: adminOpsJobSelect,
        orderBy: [
          {
            createdAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
        take: RECENT_JOBS_LIMIT,
      }),
      this.prisma.job.findMany({
        where: {
          status: 'CANCELED',
        },
        select: adminOpsJobSelect,
        orderBy: [
          {
            canceledAt: 'desc',
          },
          {
            updatedAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
        take: RECENT_JOBS_LIMIT,
      }),
      this.prisma.job.findMany({
        where: {
          status: 'COMPLETED',
          review: null,
        },
        select: adminOpsJobSelect,
        orderBy: [
          {
            completedAt: 'desc',
          },
          {
            updatedAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
        take: RECENT_JOBS_LIMIT,
      }),
    ]);

    const jobsByStatus = this.buildStatusSummary(jobsByStatusRows);
    const jobsByPricingMode = this.buildPricingModeSummary(
      jobsByPricingModeRows,
    );
    const completedJobs = jobsByStatus.COMPLETED;
    const completionRate =
      totalJobs === 0
        ? 0
        : Number(((completedJobs / totalJobs) * 100).toFixed(1));
    const averageRating =
      reviewsAggregate._avg.rating === null
        ? 0
        : Number(reviewsAggregate._avg.rating.toFixed(2));

    return {
      kpis: {
        totalJobs,
        jobsByStatus,
        completionRate,
        totalReviews,
        averageRating,
        activePublicableWorkers,
        jobsByPricingMode,
      },
      recentJobs: recentJobs.map((item) => this.toJobListItem(item)),
      recentlyCanceledJobs: recentlyCanceledJobs.map((item) =>
        this.toJobListItem(item),
      ),
      completedWithoutReviewJobs: completedWithoutReviewJobs.map((item) =>
        this.toJobListItem(item),
      ),
    };
  }

  listAuditLogs(input?: {
    page?: number;
    limit?: number;
    action?: string;
    status?: 'SUCCESS' | 'DENIED' | 'FAILED';
    actorUserId?: string;
  }) {
    return this.securityAuditService.listAuditLogs(input);
  }

  async updateUserRole(input: {
    targetUserId: string;
    role: UserRole;
    adminSubrole?: AdminSubrole | null;
    actor: {
      userId: string;
      role: AppRole;
      method: string;
      path: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    };
  }) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: input.targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminSubrole: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Utilizador não encontrado.');
    }

    if (targetUser.id === input.actor.userId && input.role !== 'ADMIN') {
      throw new BadRequestException(
        'Não podes remover o teu próprio acesso admin nesta operação.',
      );
    }

    const nextAdminSubrole =
      input.role === 'ADMIN' ? (input.adminSubrole ?? null) : null;
    const previousRoleLabel = this.formatRoleLabel(
      targetUser.role,
      targetUser.adminSubrole,
    );
    const nextRoleLabel = this.formatRoleLabel(input.role, nextAdminSubrole);

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUser.id },
      data: {
        role: input.role,
        adminSubrole: nextAdminSubrole,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminSubrole: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (
      targetUser.role !== updatedUser.role ||
      targetUser.adminSubrole !== updatedUser.adminSubrole
    ) {
      await this.prisma.session.updateMany({
        where: {
          userId: updatedUser.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    await this.securityAuditService.logRoleChange({
      actorUserId: input.actor.userId,
      actorRole: input.actor.role,
      targetUserId: updatedUser.id,
      previousRole: previousRoleLabel,
      nextRole: nextRoleLabel,
      method: input.actor.method,
      path: input.actor.path,
      ipAddress: input.actor.ipAddress ?? null,
      userAgent: input.actor.userAgent ?? null,
    });

    return updatedUser;
  }

  async updateUserStatus(input: {
    targetUserId: string;
    isActive: boolean;
    actor: {
      userId: string;
      role: AppRole;
      method: string;
      path: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    };
  }) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: input.targetUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminSubrole: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Utilizador não encontrado.');
    }

    if (targetUser.id === input.actor.userId && input.isActive === false) {
      throw new BadRequestException(
        'Não podes suspender a tua própria conta nesta operação.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUser.id },
      data: {
        isActive: input.isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminSubrole: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (!updatedUser.isActive) {
      await this.prisma.session.updateMany({
        where: {
          userId: updatedUser.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    await this.securityAuditService.logUserStatusChange({
      actorUserId: input.actor.userId,
      actorRole: input.actor.role,
      targetUserId: updatedUser.id,
      isActive: updatedUser.isActive,
      method: input.actor.method,
      path: input.actor.path,
      ipAddress: input.actor.ipAddress ?? null,
      userAgent: input.actor.userAgent ?? null,
    });

    return updatedUser;
  }

  async deleteUser(input: {
    targetUserId: string;
    actor: {
      userId: string;
      role: AppRole;
      method: string;
      path: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    };
  }) {
    if (input.targetUserId === input.actor.userId) {
      throw new BadRequestException(
        'Não podes apagar a tua própria conta administrativa.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Utilizador não encontrado.');
    }

    await this.prisma.user.delete({
      where: { id: existing.id },
    });

    await this.securityAuditService.logUserDeletion({
      actorUserId: input.actor.userId,
      actorRole: input.actor.role,
      targetUserId: existing.id,
      method: input.actor.method,
      path: input.actor.path,
      ipAddress: input.actor.ipAddress ?? null,
      userAgent: input.actor.userAgent ?? null,
    });

    return {
      id: existing.id,
      deleted: true,
    };
  }

  async upsertPlatformSetting(input: {
    key: string;
    value: Record<string, unknown>;
    actor: {
      userId: string;
      role: AppRole;
      method: string;
      path: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    };
  }) {
    const settingKey = this.normalizeSettingKey(input.key);

    const setting = await this.prisma.platformSetting.upsert({
      where: { key: settingKey },
      update: {
        value: input.value as Prisma.InputJsonValue,
        updatedByUserId: input.actor.userId,
      },
      create: {
        key: settingKey,
        value: input.value as Prisma.InputJsonValue,
        updatedByUserId: input.actor.userId,
      },
      select: {
        key: true,
        value: true,
        updatedByUserId: true,
        updatedAt: true,
      },
    });

    await this.securityAuditService.logSettingChange({
      actorUserId: input.actor.userId,
      actorRole: input.actor.role,
      settingKey: setting.key,
      method: input.actor.method,
      path: input.actor.path,
      ipAddress: input.actor.ipAddress ?? null,
      userAgent: input.actor.userAgent ?? null,
    });

    return setting;
  }

  async exportUsersSnapshot(input: {
    actor: {
      userId: string;
      role: AppRole;
      method: string;
      path: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    };
  }) {
    const [
      userRoleCount,
      adminRoleCount,
      noneAdminSubroleCount,
      supportAdminCount,
      opsAdminCount,
      superAdminCount,
      activeUsers,
      inactiveUsers,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({
        where: { role: 'USER' },
      }),
      this.prisma.user.count({
        where: { role: 'ADMIN' },
      }),
      this.prisma.user.count({
        where: {
          role: 'ADMIN',
          adminSubrole: null,
        },
      }),
      this.prisma.user.count({
        where: {
          role: 'ADMIN',
          adminSubrole: 'SUPPORT_ADMIN',
        },
      }),
      this.prisma.user.count({
        where: {
          role: 'ADMIN',
          adminSubrole: 'OPS_ADMIN',
        },
      }),
      this.prisma.user.count({
        where: {
          role: 'ADMIN',
          adminSubrole: 'SUPER_ADMIN',
        },
      }),
      this.prisma.user.count({
        where: { isActive: true },
      }),
      this.prisma.user.count({
        where: { isActive: false },
      }),
    ]);

    const totalsByRole: Record<UserRole, number> = {
      USER: userRoleCount,
      ADMIN: adminRoleCount,
    };

    const totalsByAdminSubrole: Record<AdminSubrole | 'none', number> = {
      none: noneAdminSubroleCount,
      SUPPORT_ADMIN: supportAdminCount,
      OPS_ADMIN: opsAdminCount,
      SUPER_ADMIN: superAdminCount,
    };

    const totalRecords = totalsByRole.USER + totalsByRole.ADMIN;

    await this.securityAuditService.logSensitiveExport({
      actorUserId: input.actor.userId,
      actorRole: input.actor.role,
      exportName: 'users_snapshot',
      method: input.actor.method,
      path: input.actor.path,
      ipAddress: input.actor.ipAddress ?? null,
      userAgent: input.actor.userAgent ?? null,
      records: totalRecords,
    });

    return {
      totalsByRole,
      totalsByAdminSubrole,
      activeUsers,
      inactiveUsers,
      exportedAt: new Date().toISOString(),
    };
  }

  private buildStatusSummary(
    rows: Array<{
      status: JobStatus;
      _count?:
        | {
            _all?: number;
          }
        | true
        | null;
    }>,
  ): StatusSummary {
    const summary = this.createStatusSummary();

    for (const row of rows) {
      summary[row.status] = this.readGroupCount(row._count);
    }

    return summary;
  }

  private createStatusSummary(): StatusSummary {
    return statusOrder.reduce<StatusSummary>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as StatusSummary);
  }

  private buildPricingModeSummary(
    rows: Array<{
      pricingMode: JobPricingMode;
      _count?:
        | {
            _all?: number;
          }
        | true
        | null;
    }>,
  ): PricingModeSummary {
    const summary = this.createPricingModeSummary();

    for (const row of rows) {
      summary[row.pricingMode] = this.readGroupCount(row._count);
    }

    return summary;
  }

  private readGroupCount(
    count:
      | {
          _all?: number;
        }
      | true
      | null
      | undefined,
  ): number {
    if (count === true) {
      return 0;
    }

    return count?._all ?? 0;
  }

  private createPricingModeSummary(): PricingModeSummary {
    return pricingModeOrder.reduce<PricingModeSummary>((acc, pricingMode) => {
      acc[pricingMode] = 0;
      return acc;
    }, {} as PricingModeSummary);
  }

  private toJobListItem(item: AdminOpsJobRecord) {
    return {
      id: item.id,
      title: item.title,
      status: item.status,
      pricingMode: item.pricingMode,
      clientId: item.clientId,
      workerProfileId: item.workerProfileId,
      budget: item.budget,
      quotedAmount: item.quotedAmount,
      cancelReason: item.cancelReason,
      hasReview: Boolean(item.review),
      createdAt: item.createdAt,
      acceptedAt: item.acceptedAt,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      canceledAt: item.canceledAt,
    };
  }

  private normalizeSettingKey(value: string): string {
    const normalized = value.trim().toLowerCase();

    if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(normalized)) {
      throw new BadRequestException(
        'Chave de configuração inválida. Usa letras minúsculas, números, ".", "_" ou "-".',
      );
    }

    return normalized.slice(0, 80);
  }

  private formatRoleLabel(
    role: UserRole,
    adminSubrole: AdminSubrole | null,
  ): string {
    if (role !== 'ADMIN') {
      return 'customer';
    }

    if (adminSubrole === 'SUPPORT_ADMIN') {
      return 'support_admin';
    }

    if (adminSubrole === 'OPS_ADMIN') {
      return 'ops_admin';
    }

    if (adminSubrole === 'SUPER_ADMIN') {
      return 'super_admin';
    }

    return 'admin';
  }
}
