import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessContext, AppRole, Permission } from './authorization.types';

const rolePermissions: Record<AppRole, Permission[]> = {
  guest: ['public.read'],
  customer: [
    'public.read',
    'customer.jobs.create',
    'customer.jobs.read.own',
    'customer.reviews.create',
    'customer.reviews.read.own',
    'provider.profile.manage',
    'provider.jobs.read.own',
    'provider.jobs.quote.propose',
  ],
  provider: [
    'public.read',
    'customer.jobs.create',
    'customer.jobs.read.own',
    'customer.reviews.create',
    'customer.reviews.read.own',
    'provider.profile.manage',
    'provider.jobs.read.own',
    'provider.jobs.quote.propose',
    'provider.jobs.status.update',
    'provider.reviews.read.received',
  ],
  admin: [
    'public.read',
    'customer.jobs.create',
    'customer.jobs.read.own',
    'customer.reviews.create',
    'customer.reviews.read.own',
    'provider.profile.manage',
    'provider.jobs.read.own',
    'provider.jobs.quote.propose',
    'provider.jobs.status.update',
    'provider.reviews.read.received',
    'admin.ops.read',
    'admin.categories.manage',
    'admin.users.manage',
    'admin.providers.manage',
    'admin.orders.manage',
    'admin.reports.read',
    'admin.moderation.manage',
    'admin.settings.manage',
    'admin.audit.read',
  ],
  support_admin: [
    'public.read',
    'admin.ops.read',
    'admin.users.manage',
    'admin.providers.manage',
    'admin.reports.read',
    'admin.moderation.manage',
    'admin.audit.read',
  ],
  ops_admin: [
    'public.read',
    'admin.ops.read',
    'admin.categories.manage',
    'admin.orders.manage',
    'admin.reports.read',
    'admin.settings.manage',
    'admin.audit.read',
  ],
  super_admin: [
    'public.read',
    'admin.ops.read',
    'admin.categories.manage',
    'admin.users.manage',
    'admin.providers.manage',
    'admin.orders.manage',
    'admin.reports.read',
    'admin.moderation.manage',
    'admin.settings.manage',
    'admin.audit.read',
  ],
};

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveAccessContext(input: {
    userId?: string | null;
    platformRole?: 'USER' | 'ADMIN' | null;
  }): Promise<AccessContext> {
    if (!input.userId) {
      return {
        userId: null,
        role: 'guest',
        permissions: rolePermissions.guest,
        isAuthenticated: false,
      };
    }

    if (input.platformRole === 'ADMIN') {
      return {
        userId: input.userId,
        role: 'admin',
        permissions: rolePermissions.admin,
        isAuthenticated: true,
      };
    }

    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: { userId: input.userId },
      select: { id: true },
    });

    const role: AppRole = workerProfile ? 'provider' : 'customer';
    return {
      userId: input.userId,
      role,
      permissions: rolePermissions[role],
      isAuthenticated: true,
    };
  }

  hasAnyRole(contextRole: AppRole, requiredRoles: AppRole[]): boolean {
    if (requiredRoles.length === 0) {
      return true;
    }

    if (requiredRoles.includes(contextRole)) {
      return true;
    }

    if (contextRole === 'super_admin' && requiredRoles.includes('admin')) {
      return true;
    }

    return false;
  }

  hasAllPermissions(
    contextPermissions: Permission[],
    requiredPermissions: Permission[],
  ): boolean {
    if (requiredPermissions.length === 0) {
      return true;
    }

    const available = new Set(contextPermissions);
    return requiredPermissions.every((permission) => available.has(permission));
  }
}
