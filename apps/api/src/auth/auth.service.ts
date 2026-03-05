import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Session, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
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
  private readonly accessSecret =
    process.env.JWT_ACCESS_SECRET || 'change-me-access';
  private readonly refreshSecret =
    process.env.JWT_REFRESH_SECRET || 'change-me-refresh';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(
    dto: RegisterDto,
    clientInfo?: SessionClientInfo,
  ): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
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
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user, clientInfo);
  }

  async refresh(
    refreshToken: string,
    clientInfo?: SessionClientInfo,
  ): Promise<AuthResponse> {
    const payload = this.verifyRefreshToken(refreshToken);
    const refreshTokenHash = this.hashToken(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!session.user.isActive || session.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.sid !== session.id || payload.did !== session.deviceId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(session.user, clientInfo, session);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const refreshTokenHash = this.hashToken(refreshToken);

    await this.prisma.session.updateMany({
      where: { refreshTokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
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
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
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

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
