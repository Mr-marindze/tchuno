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

    return next.handle().pipe(
      tap(() => {
        if (!userId) {
          return;
        }

        this.securityAuditService.logAdminAction({
          userId,
          role,
          action,
          method: request.method,
          path: request.originalUrl ?? request.path,
          status: 'success',
          reauthRequired,
        });
      }),
      catchError((error: unknown) => {
        if (userId) {
          this.securityAuditService.logAdminAction({
            userId,
            role,
            action,
            method: request.method,
            path: request.originalUrl ?? request.path,
            status: 'failed',
            reauthRequired,
          });
        }
        return throwError(() => error as Error);
      }),
    );
  }
}
