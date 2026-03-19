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
import { SecurityAuditService } from '../security-audit.service';

type RequestWithUser = {
  method: string;
  path: string;
  originalUrl?: string;
  user?: {
    sub?: string;
    user?: {
      role?: 'USER' | 'ADMIN';
    };
  };
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
    const reauthRequired =
      this.reflector.getAllAndOverride<boolean>(REQUIRE_REAUTH_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.sub ?? null;

    if (!userId) {
      this.securityAuditService.logForbiddenAccess({
        userId: null,
        role: 'guest',
        method: request.method,
        path: request.originalUrl ?? request.path,
        requiredRoles,
        requiredPermissions,
      });
      throw new UnauthorizedException('Autenticação necessária');
    }

    const contextAccess = await this.authorizationService.resolveAccessContext({
      userId,
      platformRole: request.user?.user?.role ?? null,
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
      return true;
    }

    this.securityAuditService.logForbiddenAccess({
      userId,
      role: contextAccess.role,
      method: request.method,
      path: request.originalUrl ?? request.path,
      requiredRoles,
      requiredPermissions,
    });

    throw new ForbiddenException('Permissão insuficiente para esta operação');
  }
}
