import { Injectable, Logger } from '@nestjs/common';
import { AuditStatus, Prisma } from '@prisma/client';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppRole } from './authorization.types';

const SENSITIVE_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
]);

export type AuditLogFilter = {
  page?: number;
  limit?: number;
  action?: string;
  status?: AuditStatus;
  actorUserId?: string;
};

type AuditEventInput = {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  status: AuditStatus;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  route: string;
  method: string;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger('SecurityAudit');

  constructor(
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  async listAuditLogs(input?: AuditLogFilter) {
    const page = Math.max(1, input?.page ?? 1);
    const limit = Math.min(Math.max(1, input?.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      ...(input?.action
        ? {
            action: {
              contains: input.action,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(input?.status ? { status: input.status } : {}),
      ...(input?.actorUserId ? { actorUserId: input.actorUserId } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        hasNext: skip + rows.length < total,
      },
    };
  }

  async logAdminLogin(input: {
    userId: string;
    role: AppRole;
    email: string;
    ip?: string | null;
    deviceId?: string | null;
    userAgent?: string | null;
  }) {
    this.logger.log(
      JSON.stringify({
        event: 'admin_login_success',
        userId: input.userId,
        role: input.role,
        email: input.email,
        ip: input.ip ?? null,
        deviceId: input.deviceId ?? null,
      }),
    );

    await this.recordAuditEvent({
      actorUserId: input.userId,
      actorRole: input.role,
      action: 'admin.login',
      targetType: 'auth',
      targetId: input.userId,
      status: 'SUCCESS',
      ipAddress: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      route: '/auth/login',
      method: 'POST',
      metadata: {
        email: input.email,
        deviceId: input.deviceId ?? null,
      },
    });

    this.metricsService.recordBusinessEvent({
      domain: 'auth',
      event: 'admin_login_success',
      result: 'success',
    });
  }

  async logForbiddenAccess(input: {
    userId?: string | null;
    role?: AppRole | null;
    method: string;
    path: string;
    requiredRoles: AppRole[];
    requiredPermissions: string[];
    ipAddress?: string | null;
    userAgent?: string | null;
    reason?: string | null;
  }) {
    this.logger.warn(
      JSON.stringify({
        event: 'forbidden_access',
        userId: input.userId ?? null,
        role: input.role ?? null,
        method: input.method,
        path: input.path,
        requiredRoles: input.requiredRoles,
        requiredPermissions: input.requiredPermissions,
      }),
    );

    await this.recordAuditEvent({
      actorUserId: input.userId ?? null,
      actorRole: input.role ?? null,
      action: 'auth.access.denied',
      targetType: 'route',
      targetId: input.path,
      status: 'DENIED',
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      route: input.path,
      method: input.method,
      metadata: {
        requiredRoles: input.requiredRoles,
        requiredPermissions: input.requiredPermissions,
      },
    });

    this.metricsService.recordBusinessEvent({
      domain: 'auth',
      event: 'forbidden_access',
      result: 'blocked',
    });
  }

  async logAdminAction(input: {
    userId: string;
    role: AppRole;
    action: string;
    method: string;
    path: string;
    status: 'success' | 'failed';
    targetType?: string | null;
    targetId?: string | null;
    reason?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    reauthRequired?: boolean;
    metadata?: Record<string, unknown> | null;
  }) {
    const status = input.status === 'success' ? 'SUCCESS' : 'FAILED';

    this.logger.log(
      JSON.stringify({
        event: 'admin_action',
        userId: input.userId,
        role: input.role,
        action: input.action,
        method: input.method,
        path: input.path,
        status: input.status,
      }),
    );

    await this.recordAuditEvent({
      actorUserId: input.userId,
      actorRole: input.role,
      action: input.action,
      targetType: input.targetType ?? 'route',
      targetId: input.targetId ?? input.path,
      status,
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      route: input.path,
      method: input.method,
      metadata: {
        ...(input.metadata ?? {}),
        reauthRequired: input.reauthRequired ?? false,
      },
    });

    this.metricsService.recordBusinessEvent({
      domain: 'auth',
      event: `admin_action_${input.action}`,
      result: input.status === 'success' ? 'success' : 'failed',
    });
  }

  async logReauthFailure(input: {
    userId: string;
    role: string;
    reason: string;
    method: string;
    path: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    this.logger.warn(
      JSON.stringify({
        event: 'reauth_failed',
        userId: input.userId,
        role: input.role,
        reason: input.reason,
        method: input.method,
        path: input.path,
      }),
    );

    await this.recordAuditEvent({
      actorUserId: input.userId,
      actorRole: input.role,
      action: 'auth.reauth',
      targetType: 'auth',
      targetId: input.userId,
      status: 'FAILED',
      reason: input.reason,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      route: input.path,
      method: input.method,
    });
  }

  async logReauthSuccess(input: {
    userId: string;
    role: string;
    method: string;
    path: string;
    purpose?: string | null;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    this.logger.log(
      JSON.stringify({
        event: 'reauth_success',
        userId: input.userId,
        role: input.role,
        method: input.method,
        path: input.path,
      }),
    );

    await this.recordAuditEvent({
      actorUserId: input.userId,
      actorRole: input.role,
      action: 'auth.reauth',
      targetType: 'auth',
      targetId: input.userId,
      status: 'SUCCESS',
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      route: input.path,
      method: input.method,
      metadata: {
        purpose: input.purpose ?? null,
        expiresAt: input.expiresAt.toISOString(),
      },
    });
  }

  async logRoleChange(input: {
    actorUserId: string;
    actorRole: AppRole;
    targetUserId: string;
    previousRole: string;
    nextRole: string;
    method: string;
    path: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    await this.logAdminAction({
      userId: input.actorUserId,
      role: input.actorRole,
      action: 'admin.user.role.change',
      method: input.method,
      path: input.path,
      status: 'success',
      targetType: 'user',
      targetId: input.targetUserId,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      reauthRequired: true,
      metadata: {
        previousRole: input.previousRole,
        nextRole: input.nextRole,
      },
    });
  }

  async logUserStatusChange(input: {
    actorUserId: string;
    actorRole: AppRole;
    targetUserId: string;
    isActive: boolean;
    method: string;
    path: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    await this.logAdminAction({
      userId: input.actorUserId,
      role: input.actorRole,
      action: input.isActive ? 'admin.user.reactivate' : 'admin.user.suspend',
      method: input.method,
      path: input.path,
      status: 'success',
      targetType: 'user',
      targetId: input.targetUserId,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      reauthRequired: true,
      metadata: {
        isActive: input.isActive,
      },
    });
  }

  async logUserDeletion(input: {
    actorUserId: string;
    actorRole: AppRole;
    targetUserId: string;
    method: string;
    path: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    await this.logAdminAction({
      userId: input.actorUserId,
      role: input.actorRole,
      action: 'admin.user.delete',
      method: input.method,
      path: input.path,
      status: 'success',
      targetType: 'user',
      targetId: input.targetUserId,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      reauthRequired: true,
    });
  }

  async logSettingChange(input: {
    actorUserId: string;
    actorRole: AppRole;
    settingKey: string;
    method: string;
    path: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    await this.logAdminAction({
      userId: input.actorUserId,
      role: input.actorRole,
      action: 'admin.setting.change',
      method: input.method,
      path: input.path,
      status: 'success',
      targetType: 'setting',
      targetId: input.settingKey,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      reauthRequired: true,
    });
  }

  async logSensitiveExport(input: {
    actorUserId: string;
    actorRole: AppRole;
    exportName: string;
    method: string;
    path: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    records: number;
  }) {
    await this.logAdminAction({
      userId: input.actorUserId,
      role: input.actorRole,
      action: 'admin.data.export',
      method: input.method,
      path: input.path,
      status: 'success',
      targetType: 'export',
      targetId: input.exportName,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      reauthRequired: true,
      metadata: {
        records: input.records,
      },
    });
  }

  private async recordAuditEvent(input: AuditEventInput): Promise<void> {
    const sanitizedMetadata = this.sanitizeMetadata(input.metadata ?? null);

    const payload: Prisma.AuditLogCreateInput = {
      action: input.action,
      actorRole: this.sanitizeNullable(input.actorRole ?? null, 64),
      targetType: this.sanitizeNullable(input.targetType ?? null, 64),
      targetId: this.sanitizeNullable(input.targetId ?? null, 128),
      status: input.status,
      reason: this.sanitizeNullable(input.reason ?? null, 512),
      ipAddress: this.sanitizeNullable(input.ipAddress ?? null, 64),
      userAgent: this.sanitizeNullable(input.userAgent ?? null, 512),
      route: this.sanitizeNullable(input.route, 256) ?? 'unknown',
      method: this.sanitizeNullable(input.method, 16) ?? 'UNKNOWN',
      ...(sanitizedMetadata
        ? {
            metadata: sanitizedMetadata,
          }
        : {}),
      ...(input.actorUserId
        ? {
            actor: {
              connect: {
                id: input.actorUserId,
              },
            },
          }
        : {}),
    };

    try {
      await this.prisma.auditLog.create({
        data: payload,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist audit event ${input.action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private sanitizeMetadata(
    value: Record<string, unknown> | null,
  ): Prisma.InputJsonValue | null {
    if (!value) {
      return null;
    }

    const walk = (entry: unknown): Prisma.InputJsonValue | undefined => {
      if (entry === null) {
        return undefined;
      }

      if (typeof entry === 'string') {
        return entry.length > 1024 ? `${entry.slice(0, 1024)}...` : entry;
      }

      if (typeof entry === 'number' || typeof entry === 'boolean') {
        return entry;
      }

      if (Array.isArray(entry)) {
        return entry
          .slice(0, 50)
          .map((item) => walk(item))
          .filter((item): item is Prisma.InputJsonValue => item !== undefined);
      }

      if (typeof entry === 'object') {
        const objectValue = entry as Record<string, unknown>;
        const acc: Record<string, Prisma.InputJsonValue> = {};

        for (const [key, raw] of Object.entries(objectValue)) {
          const normalizedKey = key.trim().toLowerCase();
          if (SENSITIVE_METADATA_KEYS.has(normalizedKey)) {
            continue;
          }

          const child = walk(raw);
          if (child !== undefined) {
            acc[key] = child;
          }
        }

        return acc;
      }

      return undefined;
    };

    const sanitized = walk(value);
    if (!sanitized || Array.isArray(sanitized)) {
      return null;
    }

    return sanitized as Prisma.InputJsonValue;
  }

  private sanitizeNullable(
    value: string | null,
    maxLength: number,
  ): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    return normalized.slice(0, maxLength);
  }
}
