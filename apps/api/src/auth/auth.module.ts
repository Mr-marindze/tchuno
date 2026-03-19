import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ObservabilityModule } from '../observability/observability.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthorizationService } from './authorization.service';
import { AuthService } from './auth.service';
import { AccessPolicyGuard } from './guards/access-policy.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminActionAuditInterceptor } from './interceptors/admin-action-audit.interceptor';
import { ReauthService } from './reauth.service';
import { SecurityAuditService } from './security-audit.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Global()
@Module({
  imports: [
    PrismaModule,
    ObservabilityModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'change-me-access',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    AuthorizationService,
    ReauthService,
    AccessPolicyGuard,
    SecurityAuditService,
    AdminActionAuditInterceptor,
  ],
  exports: [
    AuthService,
    AuthorizationService,
    ReauthService,
    AccessPolicyGuard,
    SecurityAuditService,
    AdminActionAuditInterceptor,
  ],
})
export class AuthModule {}
