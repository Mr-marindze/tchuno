import { Injectable } from '@nestjs/common';
import { AdminSubrole } from '@prisma/client';
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
    // MVP onboarding: allows a customer account to create its own provider profile.
    'provider.profile.manage',
  ],
  provider: [
    'public.read',
    'provider.profile.manage',
    'provider.jobs.read.own',
    'provider.jobs.quote.propose',
    'provider.jobs.status.update',
    'provider.reviews.read.received',
  ],
  admin: [
    'public.read',
    'admin.ops.read',
    'admin.categories.manage',
    'admin.roles.manage',
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
    'admin.roles.manage',
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
    adminSubrole?: AdminSubrole | null;
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
      const adminRole = this.resolveAdminRole(input.adminSubrole);
      return {
        userId: input.userId,
        role: adminRole,
        permissions: rolePermissions[adminRole],
        isAuthenticated: true,
      };
    }

    const isProvider = await this.isProviderUser(input.userId);
    const role: AppRole = isProvider ? 'provider' : 'customer';
    return {
      userId: input.userId,
      role,
      permissions: rolePermissions[role],
      isAuthenticated: true,
    };
  }

  private resolveAdminRole(adminSubrole?: AdminSubrole | null): AppRole {
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

  private async isProviderUser(userId: string): Promise<boolean> {
    // MVP compatibility: provider is currently inferred from worker profile existence.
    // This keeps legacy behavior stable while centralizing the decision in one place.
    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    return Boolean(workerProfile);
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
