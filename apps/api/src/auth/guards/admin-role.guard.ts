import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

type RequestWithRole = {
  user?: {
    user?: {
      role?: string;
    };
  };
};

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithRole>();
    const role = request.user?.user?.role;

    if (role === 'ADMIN') {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}
