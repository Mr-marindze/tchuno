import { Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthResponse } from './types';

const REFRESH_COOKIE_NAME = 'tchuno_refresh_token';
const SESSION_MARKER_COOKIE_NAME = 'tchuno_session_present';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthCookieService {
  applyAuthCookies(res: Response, auth: AuthResponse): void {
    res.cookie(
      REFRESH_COOKIE_NAME,
      auth.refreshToken,
      this.buildRefreshCookieOptions(),
    );
    res.cookie(
      SESSION_MARKER_COOKIE_NAME,
      '1',
      this.buildSessionMarkerCookieOptions(),
    );
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, this.buildRefreshCookieClearOptions());
    res.clearCookie(
      SESSION_MARKER_COOKIE_NAME,
      this.buildSessionMarkerCookieClearOptions(),
    );
  }

  readRefreshToken(req: Request): string | undefined {
    const cookies = this.parseCookieHeader(req.headers.cookie);
    return cookies[REFRESH_COOKIE_NAME];
  }

  private parseCookieHeader(
    rawCookieHeader: string | undefined,
  ): Record<string, string> {
    if (!rawCookieHeader) {
      return {};
    }

    return rawCookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .reduce<Record<string, string>>((acc, part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex <= 0) {
          return acc;
        }

        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();

        if (!key) {
          return acc;
        }

        acc[key] = decodeURIComponent(value);
        return acc;
      }, {});
  }

  private buildRefreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: this.resolveSameSite(),
      secure: this.isSecureCookieEnabled(),
      path: '/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      ...(this.resolveCookieDomain()
        ? { domain: this.resolveCookieDomain() }
        : {}),
    };
  }

  private buildSessionMarkerCookieOptions(): CookieOptions {
    return {
      httpOnly: false,
      sameSite: this.resolveSameSite(),
      secure: this.isSecureCookieEnabled(),
      path: '/',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      ...(this.resolveCookieDomain()
        ? { domain: this.resolveCookieDomain() }
        : {}),
    };
  }

  private buildRefreshCookieClearOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: this.resolveSameSite(),
      secure: this.isSecureCookieEnabled(),
      path: '/auth',
      ...(this.resolveCookieDomain()
        ? { domain: this.resolveCookieDomain() }
        : {}),
    };
  }

  private buildSessionMarkerCookieClearOptions(): CookieOptions {
    return {
      httpOnly: false,
      sameSite: this.resolveSameSite(),
      secure: this.isSecureCookieEnabled(),
      path: '/',
      ...(this.resolveCookieDomain()
        ? { domain: this.resolveCookieDomain() }
        : {}),
    };
  }

  private resolveSameSite(): CookieOptions['sameSite'] {
    const rawValue = (process.env.AUTH_COOKIE_SAME_SITE ?? 'lax')
      .trim()
      .toLowerCase();

    if (rawValue === 'strict') {
      return 'strict';
    }

    if (rawValue === 'none') {
      return 'none';
    }

    return 'lax';
  }

  private isSecureCookieEnabled(): boolean {
    const override = (process.env.AUTH_COOKIE_SECURE ?? '')
      .trim()
      .toLowerCase();
    if (override === 'true') {
      return true;
    }

    if (override === 'false') {
      return false;
    }

    return process.env.NODE_ENV === 'production';
  }

  private resolveCookieDomain(): string | undefined {
    const rawValue = process.env.AUTH_COOKIE_DOMAIN?.trim();
    return rawValue && rawValue.length > 0 ? rawValue : undefined;
  }
}
