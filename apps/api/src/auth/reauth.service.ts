import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { SecurityAuditService } from './security-audit.service';
import { SessionClientInfo } from './types';

const DEFAULT_REAUTH_TTL_MINUTES = 10;

@Injectable()
export class ReauthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async confirmByPassword(input: {
    userId: string;
    password: string;
    purpose?: string;
    clientInfo?: SessionClientInfo;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        passwordHash: true,
        isActive: true,
        role: true,
        adminSubrole: true,
      },
    });

    if (!user || !user.isActive) {
      void this.securityAuditService.logReauthFailure({
        userId: input.userId,
        role: 'guest',
        reason: 'user_not_found_or_inactive',
        method: 'POST',
        path: '/auth/reauth/confirm',
        ipAddress: input.clientInfo?.ip ?? null,
        userAgent: input.clientInfo?.userAgent ?? null,
      });
      throw new UnauthorizedException(
        'Credenciais de reautenticação inválidas',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      void this.securityAuditService.logReauthFailure({
        userId: user.id,
        role: this.resolveRoleLabel(user.role, user.adminSubrole),
        reason: 'invalid_password',
        method: 'POST',
        path: '/auth/reauth/confirm',
        ipAddress: input.clientInfo?.ip ?? null,
        userAgent: input.clientInfo?.userAgent ?? null,
      });
      throw new UnauthorizedException(
        'Credenciais de reautenticação inválidas',
      );
    }

    const reauthToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(reauthToken);
    const expiresAt = new Date(
      Date.now() + this.resolveReauthTtlMinutes() * 60_000,
    );

    await this.prisma.$transaction([
      this.prisma.reauthChallenge.updateMany({
        where: {
          userId: user.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.prisma.reauthChallenge.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          purpose: input.purpose ?? null,
          ipAddress: this.sanitizeNullable(input.clientInfo?.ip ?? null, 64),
          userAgent: this.sanitizeNullable(
            input.clientInfo?.userAgent ?? null,
            512,
          ),
        },
      }),
    ]);

    void this.securityAuditService.logReauthSuccess({
      userId: user.id,
      role: this.resolveRoleLabel(user.role, user.adminSubrole),
      method: 'POST',
      path: '/auth/reauth/confirm',
      ipAddress: input.clientInfo?.ip ?? null,
      userAgent: input.clientInfo?.userAgent ?? null,
      purpose: input.purpose ?? null,
      expiresAt,
    });

    return {
      reauthToken,
      expiresAt,
    };
  }

  async consumeChallenge(input: {
    userId: string;
    token: string;
    method: string;
    path: string;
    role: string;
    purpose?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{
    ok: boolean;
    reason?:
      | 'missing_token'
      | 'invalid_or_expired'
      | 'already_used'
      | 'purpose_mismatch';
  }> {
    const token = input.token.trim();
    if (!token) {
      void this.securityAuditService.logReauthFailure({
        userId: input.userId,
        role: input.role,
        reason: 'missing_token',
        method: input.method,
        path: input.path,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
      return { ok: false, reason: 'missing_token' };
    }

    const tokenHash = this.hashToken(token);
    const now = new Date();

    const challenge = await this.prisma.reauthChallenge.findFirst({
      where: {
        userId: input.userId,
        tokenHash,
      },
      select: {
        id: true,
        expiresAt: true,
        consumedAt: true,
        purpose: true,
      },
    });

    if (!challenge) {
      void this.securityAuditService.logReauthFailure({
        userId: input.userId,
        role: input.role,
        reason: 'invalid_or_expired',
        method: input.method,
        path: input.path,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
      return { ok: false, reason: 'invalid_or_expired' };
    }

    if (challenge.consumedAt) {
      void this.securityAuditService.logReauthFailure({
        userId: input.userId,
        role: input.role,
        reason: 'already_used',
        method: input.method,
        path: input.path,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
      return { ok: false, reason: 'already_used' };
    }

    if (challenge.expiresAt <= now) {
      await this.prisma.reauthChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });
      void this.securityAuditService.logReauthFailure({
        userId: input.userId,
        role: input.role,
        reason: 'invalid_or_expired',
        method: input.method,
        path: input.path,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
      return { ok: false, reason: 'invalid_or_expired' };
    }

    const requiredPurpose = input.purpose?.trim().toLowerCase() ?? null;
    const challengePurpose = challenge.purpose?.trim().toLowerCase() ?? null;

    if (
      requiredPurpose &&
      challengePurpose &&
      requiredPurpose !== challengePurpose
    ) {
      void this.securityAuditService.logReauthFailure({
        userId: input.userId,
        role: input.role,
        reason: 'purpose_mismatch',
        method: input.method,
        path: input.path,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
      return { ok: false, reason: 'purpose_mismatch' };
    }

    await this.prisma.reauthChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now },
    });

    return { ok: true };
  }

  resolveReauthTtlMinutes(): number {
    const raw = process.env.AUTH_REAUTH_TTL_MINUTES;
    const parsed = Number(raw);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_REAUTH_TTL_MINUTES;
    }

    return Math.min(Math.max(parsed, 1), 30);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sanitizeNullable(
    value: string | null,
    maxLength: number,
  ): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    return normalized.slice(0, maxLength);
  }

  private resolveRoleLabel(
    role: 'USER' | 'ADMIN',
    adminSubrole: 'SUPPORT_ADMIN' | 'OPS_ADMIN' | 'SUPER_ADMIN' | null,
  ): string {
    if (role !== 'ADMIN') {
      return 'customer';
    }

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
