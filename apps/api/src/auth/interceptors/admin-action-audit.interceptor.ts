import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { SecurityAuditService } from '../security-audit.service';

type RequestWithUser = {
  method: string;
  path: string;
  originalUrl?: string;
  params?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: {
    sub?: string;
  };
  authz?: {
    role?: 'admin' | 'support_admin' | 'ops_admin' | 'super_admin';
    reauthRequired?: boolean;
  };
};

@Injectable()
export class AdminActionAuditInterceptor implements NestInterceptor {
  constructor(private readonly securityAuditService: SecurityAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const action = `${request.method} ${request.path}`;
    const role = request.authz?.role ?? 'admin';
    const reauthRequired = request.authz?.reauthRequired ?? false;
    const userId = request.user?.sub;
    const targetId = request.params?.id ?? null;
    const userAgentHeader = request.headers?.['user-agent'];
    const userAgent = Array.isArray(userAgentHeader)
      ? (userAgentHeader[0] ?? null)
      : (userAgentHeader ?? null);

    return next.handle().pipe(
      tap(() => {
        if (!userId) {
          return;
        }

        void this.securityAuditService.logAdminAction({
          userId,
          role,
          action,
          method: request.method,
          path: request.originalUrl ?? request.path,
          status: 'success',
          targetType: targetId ? 'entity' : 'route',
          targetId,
          ipAddress: request.ip ?? null,
          userAgent,
          reauthRequired,
        });
      }),
      catchError((error: unknown) => {
        if (userId) {
          void this.securityAuditService.logAdminAction({
            userId,
            role,
            action,
            method: request.method,
            path: request.originalUrl ?? request.path,
            status: 'failed',
            targetType: targetId ? 'entity' : 'route',
            targetId,
            reason: error instanceof Error ? error.message : 'unknown_error',
            ipAddress: request.ip ?? null,
            userAgent,
            reauthRequired,
          });
        }
        return throwError(() => error as Error);
      }),
    );
  }
}
