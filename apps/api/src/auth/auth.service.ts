import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  PasswordRecoveryRequestStatus,
  Prisma,
  Session,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { LoginDto } from './dto/login.dto';
import { ListPasswordRecoveryRequestsQueryDto } from './dto/list-password-recovery-requests-query.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordRecoveryDto } from './dto/request-password-recovery.dto';
import { UpdatePasswordRecoveryRequestDto } from './dto/update-password-recovery-request.dto';
import { SecurityAuditService } from './security-audit.service';
import { AuthResponse, SessionClientInfo } from './types';
import { AppRole } from './authorization.types';

type RefreshTokenPayload = {
  sub: string;
  email: string;
  type: 'refresh';
  sid: string;
  did: string;
  jti: string;
  exp: number;
  iat: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret = this.resolveSecret(
    'JWT_ACCESS_SECRET',
    'change-me-access',
  );
  private readonly refreshSecret = this.resolveSecret(
    'JWT_REFRESH_SECRET',
    'change-me-refresh',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly metricsService: MetricsService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async register(
    dto: RegisterDto,
    clientInfo?: SessionClientInfo,
  ): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      this.auditWarn('register_conflict', {
        email: dto.email.toLowerCase(),
        ip: clientInfo?.ip ?? null,
      });
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
      },
    });

    this.audit('register_success', {
      userId: user.id,
      ip: clientInfo?.ip ?? null,
      deviceId: clientInfo?.deviceId ?? null,
    });

    return this.issueTokens(user, clientInfo);
  }

  async login(
    dto: LoginDto,
    clientInfo?: SessionClientInfo,
  ): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      this.auditWarn('login_failed', {
        reason: 'user_not_found',
        email: dto.email.toLowerCase(),
        ip: clientInfo?.ip ?? null,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      this.auditWarn('login_failed', {
        reason: 'invalid_password',
        userId: user.id,
        ip: clientInfo?.ip ?? null,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    this.audit('login_success', {
      userId: user.id,
      ip: clientInfo?.ip ?? null,
      deviceId: clientInfo?.deviceId ?? null,
    });

    if (user.role === 'ADMIN') {
      void this.securityAuditService.logAdminLogin({
        userId: user.id,
        role: this.resolveAdminRoleLabel(user.adminSubrole),
        email: user.email,
        ip: clientInfo?.ip ?? null,
        deviceId: clientInfo?.deviceId ?? null,
        userAgent: clientInfo?.userAgent ?? null,
      });
    }

    return this.issueTokens(user, clientInfo);
  }

  async refresh(
    refreshToken: string,
    clientInfo?: SessionClientInfo,
  ): Promise<AuthResponse> {
    const payload = this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (!session) {
      this.auditWarn('refresh_failed', {
        reason: 'session_not_found',
        sid: payload.sid,
        sub: payload.sub,
        ip: clientInfo?.ip ?? null,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      this.auditWarn('refresh_failed', {
        reason: 'session_revoked',
        sessionId: session.id,
        userId: session.userId,
        ip: clientInfo?.ip ?? null,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!session.user.isActive || session.userId !== payload.sub) {
      this.auditWarn('refresh_failed', {
        reason: 'subject_mismatch_or_inactive',
        sessionId: session.id,
        userId: session.userId,
        sub: payload.sub,
        ip: clientInfo?.ip ?? null,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.sid !== session.id || payload.did !== session.deviceId) {
      await this.revokeSessionChain(session.id, session.userId);
      this.auditWarn('refresh_reuse_detected', {
        reason: 'session_or_device_claim_mismatch',
        sessionId: session.id,
        userId: session.userId,
        ip: clientInfo?.ip ?? null,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshTokenHash = this.hashToken(refreshToken);
    if (refreshTokenHash !== session.refreshTokenHash) {
      await this.revokeSessionChain(session.id, session.userId);
      this.auditWarn('refresh_reuse_detected', {
        reason: 'rotated_token_reused',
        sessionId: session.id,
        userId: session.userId,
        ip: clientInfo?.ip ?? null,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    this.audit('refresh_success', {
      sessionId: session.id,
      userId: session.userId,
      ip: clientInfo?.ip ?? null,
      deviceId: clientInfo?.deviceId ?? null,
    });

    return this.issueTokens(session.user, clientInfo, session);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const refreshTokenHash = this.hashToken(refreshToken);

    const result = await this.prisma.session.updateMany({
      where: { refreshTokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.audit('logout', {
      revokedSessions: result.count,
    });
  }

  async logoutAll(userId: string): Promise<void> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.audit('logout_all', {
      userId,
      revokedSessions: result.count,
    });
  }

  async listSessions(userId: string, query: ListSessionsQueryDto) {
    const status = query.status ?? 'active';
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const sort = query.sort ?? 'lastUsedAt:desc';

    const [sortField, sortDirection] = sort.split(':') as [
      'lastUsedAt' | 'createdAt',
      'asc' | 'desc',
    ];

    const where: Prisma.SessionWhereInput = { userId };

    if (status === 'active') {
      where.revokedAt = null;
    } else if (status === 'revoked') {
      where.revokedAt = { not: null };
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.session.count({ where }),
      this.prisma.session.findMany({
        where,
        select: {
          id: true,
          deviceId: true,
          ip: true,
          userAgent: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
        },
        orderBy: [{ [sortField]: sortDirection }],
        take: limit,
        skip: offset,
      }),
    ]);

    const page = Math.floor(offset / limit) + 1;
    const pageCount = total === 0 ? 1 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        limit,
        offset,
        page,
        pageCount,
        hasNext: offset + data.length < total,
        hasPrev: offset > 0,
      },
    };
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.audit('session_revoke', {
      userId,
      sessionId,
      revokedSessions: result.count,
    });
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async requestPasswordRecovery(
    dto: RequestPasswordRecoveryDto,
    clientInfo?: SessionClientInfo,
  ) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
      },
    });

    const existing = await this.prisma.passwordRecoveryRequest.findFirst({
      where: {
        email,
        status: {
          in: [
            PasswordRecoveryRequestStatus.OPEN,
            PasswordRecoveryRequestStatus.IN_PROGRESS,
          ],
        },
      },
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    });

    if (!existing) {
      await this.prisma.passwordRecoveryRequest.create({
        data: {
          email,
          userId: user?.id ?? null,
        },
      });
    } else if (!existing.userId && user?.id) {
      await this.prisma.passwordRecoveryRequest.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
        },
      });
    }

    this.audit('password_recovery_requested', {
      email,
      userId: user?.id ?? null,
      ip: clientInfo?.ip ?? null,
    });

    return {
      accepted: true,
      message:
        'Recebemos o pedido. A equipa vai ajudar a recuperar a conta em segurança.',
    };
  }

  async listPasswordRecoveryRequests(
    query: ListPasswordRecoveryRequestsQueryDto,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PasswordRecoveryRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.passwordRecoveryRequest.count({ where }),
      this.prisma.passwordRecoveryRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
            },
          },
          resolvedBy: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        hasNext: skip + rows.length < total,
      },
    };
  }

  async updatePasswordRecoveryRequest(
    id: string,
    dto: UpdatePasswordRecoveryRequestDto,
    actor: {
      userId: string;
      role: AppRole;
      clientInfo?: SessionClientInfo;
    },
  ) {
    const allowedStatuses: PasswordRecoveryRequestStatus[] = [
      PasswordRecoveryRequestStatus.IN_PROGRESS,
      PasswordRecoveryRequestStatus.RESOLVED,
      PasswordRecoveryRequestStatus.CANCELED,
    ];

    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException('Invalid password recovery status');
    }

    const existing = await this.prisma.passwordRecoveryRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Password recovery request not found');
    }

    if (
      existing.status === PasswordRecoveryRequestStatus.RESOLVED ||
      existing.status === PasswordRecoveryRequestStatus.CANCELED
    ) {
      throw new ConflictException(
        'Password recovery request is already closed',
      );
    }

    const now = new Date();
    const updated = await this.prisma.passwordRecoveryRequest.update({
      where: { id },
      data: {
        status: dto.status,
        note: dto.note?.trim().length ? dto.note.trim() : existing.note,
        startedAt:
          dto.status === PasswordRecoveryRequestStatus.IN_PROGRESS
            ? (existing.startedAt ?? now)
            : existing.startedAt,
        resolvedAt:
          dto.status === PasswordRecoveryRequestStatus.RESOLVED ||
          dto.status === PasswordRecoveryRequestStatus.CANCELED
            ? now
            : null,
        resolvedByUserId:
          dto.status === PasswordRecoveryRequestStatus.RESOLVED ||
          dto.status === PasswordRecoveryRequestStatus.CANCELED
            ? actor.userId
            : null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    await this.securityAuditService.logAdminAction({
      userId: actor.userId,
      role: actor.role,
      action: 'auth.password_recovery.update',
      method: 'POST',
      path: `/auth/password-recovery/requests/${id}`,
      status: 'success',
      targetType: 'PASSWORD_RECOVERY_REQUEST',
      targetId: id,
      reason: dto.note?.trim().length ? dto.note.trim() : null,
      ipAddress: actor.clientInfo?.ip ?? null,
      userAgent: actor.clientInfo?.userAgent ?? null,
      metadata: {
        nextStatus: dto.status,
        email: existing.email,
      },
    });

    return updated;
  }

  private async issueTokens(
    user: User,
    clientInfo?: SessionClientInfo,
    existingSession?: Session,
  ): Promise<AuthResponse> {
    const session =
      existingSession ??
      (await this.prisma.session.create({
        data: {
          userId: user.id,
          deviceId: clientInfo?.deviceId || randomUUID(),
          refreshTokenHash: this.hashToken(randomUUID()),
          ip: clientInfo?.ip ?? null,
          userAgent: clientInfo?.userAgent ?? null,
        },
      }));

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.accessSecret,
        expiresIn: '15m',
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'refresh',
        sid: session.id,
        did: session.deviceId,
        jti: randomUUID(),
      },
      {
        secret: this.refreshSecret,
        expiresIn: '7d',
      },
    );

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(refreshToken),
        lastUsedAt: new Date(),
        revokedAt: null,
        ip: clientInfo?.ip ?? session.ip,
        userAgent: clientInfo?.userAgent ?? session.userAgent,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        adminSubrole: user.adminSubrole,
      },
      accessToken,
      refreshToken,
    };
  }

  private verifyRefreshToken(refreshToken: string): RefreshTokenPayload {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.refreshSecret,
        },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (!payload.sid || !payload.did || !payload.sub || !payload.jti) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async revokeSessionChain(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private resolveSecret(envName: string, fallback: string): string {
    const secret = process.env[envName] || fallback;
    const isDefaultValue =
      secret === fallback || secret.startsWith('change-me');

    if (process.env.NODE_ENV === 'production' && isDefaultValue) {
      throw new Error(`${envName} must be configured with a strong secret`);
    }

    if (secret.length < 16) {
      this.logger.warn(
        JSON.stringify({
          event: 'weak_secret_detected',
          envName,
          length: secret.length,
        }),
      );
    }

    return secret;
  }

  private audit(event: string, context: Record<string, unknown>): void {
    this.metricsService.recordBusinessEvent({
      domain: 'auth',
      event,
      result: 'success',
    });

    this.logger.log(
      JSON.stringify({
        event,
        ...context,
      }),
    );
  }

  private auditWarn(event: string, context: Record<string, unknown>): void {
    this.metricsService.recordBusinessEvent({
      domain: 'auth',
      event,
      result: event === 'register_conflict' ? 'blocked' : 'failed',
    });

    this.logger.warn(
      JSON.stringify({
        event,
        ...context,
      }),
    );
  }

  private resolveAdminRoleLabel(
    adminSubrole: User['adminSubrole'] | null,
  ): 'admin' | 'support_admin' | 'ops_admin' | 'super_admin' {
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
}
