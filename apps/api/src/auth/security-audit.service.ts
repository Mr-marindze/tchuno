import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../observability/metrics.service';
import { AppRole } from './authorization.types';

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger('SecurityAudit');

  constructor(private readonly metricsService: MetricsService) {}

  logAdminLogin(input: {
    userId: string;
    email: string;
    ip?: string | null;
    deviceId?: string | null;
  }) {
    this.logger.log(
      JSON.stringify({
        event: 'admin_login_success',
        userId: input.userId,
        email: input.email,
        ip: input.ip ?? null,
        deviceId: input.deviceId ?? null,
      }),
    );

    this.metricsService.recordBusinessEvent({
      domain: 'auth',
      event: 'admin_login_success',
      result: 'success',
    });
  }

  logForbiddenAccess(input: {
    userId?: string | null;
    role?: AppRole | null;
    method: string;
    path: string;
    requiredRoles: AppRole[];
    requiredPermissions: string[];
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

    this.metricsService.recordBusinessEvent({
      domain: 'auth',
      event: 'forbidden_access',
      result: 'blocked',
    });
  }

  logAdminAction(input: {
    userId: string;
    role: AppRole;
    action: string;
    method: string;
    path: string;
    status: 'success' | 'failed';
    reauthRequired?: boolean;
  }) {
    this.logger.log(
      JSON.stringify({
        event: 'admin_action',
        userId: input.userId,
        role: input.role,
        action: input.action,
        method: input.method,
        path: input.path,
        status: input.status,
        reauthRequired: input.reauthRequired ?? false,
      }),
    );

    this.metricsService.recordBusinessEvent({
      domain: 'auth',
      event: `admin_action_${input.action}`,
      result: input.status === 'success' ? 'success' : 'failed',
    });
  }
}
