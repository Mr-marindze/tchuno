import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminOpsModule } from './admin-ops/admin-ops.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { JobsModule } from './jobs/jobs.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ObservabilityModule } from './observability/observability.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ServiceRequestsModule } from './service-requests/service-requests.module';
import { SupportOpsModule } from './support-ops/support-ops.module';
import { TrackingModule } from './tracking/tracking.module';
import { TrustSafetyModule } from './trust-safety/trust-safety.module';
import { WorkerProfileModule } from './worker-profile/worker-profile.module';

const defaultThrottleTtlMs = 60_000;
const defaultThrottleLimit = 120;

const resolvedThrottleTtlMs = Number(process.env.THROTTLE_TTL_MS);
const resolvedThrottleLimit = Number(process.env.THROTTLE_LIMIT);

const throttlerTtlMs = Number.isFinite(resolvedThrottleTtlMs)
  ? Math.max(1000, Math.trunc(resolvedThrottleTtlMs))
  : defaultThrottleTtlMs;

const throttlerLimit = Number.isFinite(resolvedThrottleLimit)
  ? Math.max(1, Math.trunc(resolvedThrottleLimit))
  : defaultThrottleLimit;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: throttlerTtlMs,
        limit: throttlerLimit,
      },
    ]),
    AdminOpsModule,
    PrismaModule,
    AuthModule,
    CategoriesModule,
    JobsModule,
    MessagesModule,
    NotificationsModule,
    RealtimeModule,
    ObservabilityModule,
    PaymentsModule,
    ReviewsModule,
    ServiceRequestsModule,
    SupportOpsModule,
    TrackingModule,
    TrustSafetyModule,
    WorkerProfileModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
