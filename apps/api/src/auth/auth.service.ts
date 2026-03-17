import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Session, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse, SessionClientInfo } from './types';

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
}
