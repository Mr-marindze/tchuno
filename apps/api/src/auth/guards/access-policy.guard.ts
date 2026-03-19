import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_APP_ROLES_KEY,
  REQUIRE_PERMISSIONS_KEY,
  REQUIRE_REAUTH_KEY,
} from '../authorization.constants';
import { AuthorizationService } from '../authorization.service';
import { AppRole, Permission } from '../authorization.types';
import { ReauthRequirement } from '../decorators/require-reauth.decorator';
import { ReauthService } from '../reauth.service';
import { SecurityAuditService } from '../security-audit.service';
import { AdminSubrole } from '@prisma/client';

type RequestWithUser = {
  method: string;
  path: string;
  originalUrl?: string;
  user?: {
    sub?: string;
    user?: {
      role?: 'USER' | 'ADMIN';
      adminSubrole?: AdminSubrole | null;
    };
  };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  authz?: {
    role: AppRole;
    permissions: Permission[];
    reauthRequired?: boolean;
  };
};

@Injectable()
export class AccessPolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
    private readonly reauthService: ReauthService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles =
      this.reflector.getAllAndOverride<AppRole[]>(REQUIRE_APP_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRE_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const reauthRequirement =
      this.reflector.getAllAndOverride<ReauthRequirement>(REQUIRE_REAUTH_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;
    const reauthRequired = Boolean(reauthRequirement);
    const reauthPurpose =
      typeof reauthRequirement === 'object' && reauthRequirement !== null
        ? (reauthRequirement.purpose ?? null)
        : null;

    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.sub ?? null;

    if (!userId) {
      void this.securityAuditService.logForbiddenAccess({
        userId: null,
        role: 'guest',
        method: request.method,
        path: request.originalUrl ?? request.path,
        requiredRoles,
        requiredPermissions,
        ipAddress: request.ip ?? null,
        userAgent: this.extractUserAgent(request),
        reason: 'unauthenticated',
      });
      throw new UnauthorizedException('Autenticação necessária');
    }

    const contextAccess = await this.authorizationService.resolveAccessContext({
      userId,
      platformRole: request.user?.user?.role ?? null,
      adminSubrole: request.user?.user?.adminSubrole ?? null,
    });

    request.authz = {
      role: contextAccess.role,
      permissions: contextAccess.permissions,
      reauthRequired,
    };

    const hasRole = this.authorizationService.hasAnyRole(
      contextAccess.role,
      requiredRoles,
    );
    const hasPermissions = this.authorizationService.hasAllPermissions(
      contextAccess.permissions,
      requiredPermissions,
    );

    if (hasRole && hasPermissions) {
      if (!reauthRequired) {
        return true;
      }

      const reauthToken = this.extractReauthToken(request);
      const challengeResult = await this.reauthService.consumeChallenge({
        userId,
        token: reauthToken ?? '',
        method: request.method,
        path: request.originalUrl ?? request.path,
        role: contextAccess.role,
        purpose: reauthPurpose,
        ipAddress: request.ip ?? null,
        userAgent: this.extractUserAgent(request),
      });

      if (!challengeResult.ok) {
        throw new ForbiddenException({
          message: 'Reautenticação necessária para concluir esta ação.',
          code: 'REAUTH_REQUIRED',
          reauthRequired: true,
          reason: challengeResult.reason ?? 'invalid_or_expired',
        });
      }

      return true;
    }

    void this.securityAuditService.logForbiddenAccess({
      userId,
      role: contextAccess.role,
      method: request.method,
      path: request.originalUrl ?? request.path,
      requiredRoles,
      requiredPermissions,
      ipAddress: request.ip ?? null,
      userAgent: this.extractUserAgent(request),
      reason: 'insufficient_permissions',
    });

    throw new ForbiddenException('Permissão insuficiente para esta operação');
  }

  private extractReauthToken(request: RequestWithUser): string | null {
    const headerValue = request.headers?.['x-reauth-token'];
    if (!headerValue) {
      return null;
    }

    if (Array.isArray(headerValue)) {
      return headerValue[0] ?? null;
    }

    return headerValue;
  }

  private extractUserAgent(request: RequestWithUser): string | null {
    const headerValue = request.headers?.['user-agent'];
    if (!headerValue) {
      return null;
    }

    if (Array.isArray(headerValue)) {
      return headerValue[0] ?? null;
    }

    return headerValue;
  }
}
