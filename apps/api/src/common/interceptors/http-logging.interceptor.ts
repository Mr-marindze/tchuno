import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { MetricsService } from '../../observability/metrics.service';

type RequestWithContext = Request & {
  requestId?: string;
  user?: {
    sub?: string;
    email?: string;
  };
};

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    let logged = false;
    const onFinish = () => {
      if (logged) {
        return;
      }

      logged = true;
      response.off('finish', onFinish);
      this.logRequest(request, response, startedAt);
    };

    response.on('finish', onFinish);

    return next.handle();
  }

  private logRequest(
    request: RequestWithContext,
    response: Response,
    startedAt: number,
  ): void {
    const durationMs = Date.now() - startedAt;
    const route = this.resolveRoute(request);

    const payload = {
      event: 'http_request',
      requestId: request.requestId ?? null,
      method: request.method,
      route,
      statusCode: response.statusCode,
      durationMs,
      userId: request.user?.sub ?? null,
    };

    this.metricsService.recordHttpRequest({
      method: request.method,
      route,
      status: response.statusCode,
      durationMs,
    });

    if (response.statusCode >= 500) {
      this.logger.error(JSON.stringify(payload));
      return;
    }

    if (response.statusCode >= 400) {
      this.logger.warn(JSON.stringify(payload));
      return;
    }

    this.logger.log(JSON.stringify(payload));
  }

  private resolveRoute(request: RequestWithContext): string {
    const routeValue: unknown = (request as Request & { route?: unknown })
      .route;
    let path: string | null = null;

    if (typeof routeValue === 'object' && routeValue !== null) {
      const pathValue = (routeValue as { path?: unknown }).path;
      if (typeof pathValue === 'string' && pathValue.length > 0) {
        path = pathValue;
      }
    }

    const baseUrl = request.baseUrl || '';

    if (path) {
      return `${baseUrl}${path}`;
    }

    return request.path || request.url || 'unknown';
  }
}
