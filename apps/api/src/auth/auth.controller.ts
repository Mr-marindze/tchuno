import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Delete,
  Get,
  Param,
  Query,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiForbiddenResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AppRole } from './authorization.types';
import { RequireAppRoles } from './decorators/require-app-roles.decorator';
import { AuthService } from './auth.service';
import { AccessPolicyGuard } from './guards/access-policy.guard';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ErrorResponseDto } from './dto/error-response.dto';
import { ListPasswordRecoveryRequestsQueryDto } from './dto/list-password-recovery-requests-query.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordRecoveryDto } from './dto/request-password-recovery.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ConfirmReauthDto } from './dto/confirm-reauth.dto';
import { ReauthResponseDto } from './dto/reauth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionListResponseDto } from './dto/session-list-response.dto';
import { UpdatePasswordRecoveryRequestDto } from './dto/update-password-recovery-request.dto';
import { AuthorizationService } from './authorization.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ReauthService } from './reauth.service';
import { SessionClientInfo } from './types';
import { AdminSubrole } from '@prisma/client';

const registerThrottleLimitRaw = Number(
  process.env.AUTH_REGISTER_THROTTLE_LIMIT,
);
const registerThrottleLimit = Number.isFinite(registerThrottleLimitRaw)
  ? Math.max(1, Math.trunc(registerThrottleLimitRaw))
  : 10;

type AuthenticatedRequest = {
  user: {
    sub: string;
    email: string;
    user?: {
      role?: 'USER' | 'ADMIN';
      adminSubrole?: AdminSubrole | null;
    };
  };
  authz?: {
    role?: AppRole;
  };
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authorizationService: AuthorizationService,
    private readonly reauthService: ReauthService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: registerThrottleLimit, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.extractClientInfo(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login user' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.extractClientInfo(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(
      dto.refreshToken,
      this.extractClientInfo(req),
    );
  }

  @Post('password-recovery/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request assisted password recovery' })
  @ApiBody({ type: RequestPasswordRecoveryDto })
  @ApiAcceptedResponse({ description: 'Password recovery request accepted' })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  requestPasswordRecovery(
    @Body() dto: RequestPasswordRecoveryDto,
    @Req() req: Request,
  ) {
    return this.authService.requestPasswordRecovery(
      dto,
      this.extractClientInfo(req),
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('reauth/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Reauthenticate current session by confirming password for critical actions',
  })
  @ApiBody({ type: ConfirmReauthDto })
  @ApiOkResponse({ type: ReauthResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  confirmReauth(
    @Req() req: Request & AuthenticatedRequest,
    @Body() dto: ConfirmReauthDto,
  ) {
    return this.reauthService.confirmByPassword({
      userId: req.user.sub,
      password: dto.password,
      purpose: dto.purpose,
      clientInfo: this.extractClientInfo(req),
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout by revoking refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiNoContentResponse({ description: 'Successfully logged out' })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout all devices by revoking all refresh tokens',
  })
  @ApiNoContentResponse({ description: 'All sessions revoked' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  logoutAll(@Req() req: AuthenticatedRequest) {
    return this.authService.logoutAll(req.user.sub);
  }

  @Get('password-recovery/requests')
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List assisted password recovery requests' })
  @ApiOkResponse({ description: 'Paginated password recovery requests' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequireAppRoles('admin', 'ops_admin', 'support_admin', 'super_admin')
  listPasswordRecoveryRequests(
    @Query() query: ListPasswordRecoveryRequestsQueryDto,
  ) {
    return this.authService.listPasswordRecoveryRequests(query);
  }

  @Post('password-recovery/requests/:id')
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update one password recovery request status' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdatePasswordRecoveryRequestDto })
  @ApiOkResponse({ description: 'Password recovery request updated' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @RequireAppRoles('admin', 'ops_admin', 'support_admin', 'super_admin')
  updatePasswordRecoveryRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePasswordRecoveryRequestDto,
  ) {
    return this.authService.updatePasswordRecoveryRequest(id, dto, {
      userId: req.user.sub,
      role: req.authz?.role ?? 'admin',
      clientInfo: this.extractClientInfo(req as unknown as Request),
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'List user sessions/devices' })
  @ApiOkResponse({
    type: SessionListResponseDto,
    schema: {
      example: {
        data: [
          {
            id: 'cm8x8u3c10001x7k9apf4p6xv',
            deviceId: 'device-android-01',
            ip: '203.0.113.8',
            userAgent: 'Mozilla/5.0',
            createdAt: '2026-03-05T10:00:00.000Z',
            lastUsedAt: '2026-03-05T10:10:00.000Z',
            revokedAt: null,
          },
        ],
        meta: {
          total: 42,
          limit: 20,
          offset: 0,
          page: 1,
          pageCount: 3,
          hasNext: true,
          hasPrev: false,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  sessions(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListSessionsQueryDto,
  ) {
    return this.authService.listSessions(req.user.sub, query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke one specific session/device' })
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse({ description: 'Session revoked' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  revokeSession(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.authService.revokeSession(req.user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user payload from access token' })
  @ApiOkResponse({ description: 'Current user payload' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async me(@Req() req: AuthenticatedRequest) {
    const access = await this.authorizationService.resolveAccessContext({
      userId: req.user.sub,
      platformRole: req.user.user?.role ?? null,
      adminSubrole: req.user.user?.adminSubrole ?? null,
    });

    return {
      ...req.user,
      access: {
        appRole: access.role,
        permissions: access.permissions,
      },
    };
  }

  private extractClientInfo(req: Request): SessionClientInfo {
    const deviceHeader = req.headers['x-device-id'];
    const userAgentHeader = req.headers['user-agent'];

    const deviceId =
      typeof deviceHeader === 'string'
        ? deviceHeader
        : Array.isArray(deviceHeader) && typeof deviceHeader[0] === 'string'
          ? deviceHeader[0]
          : null;

    const userAgent =
      typeof userAgentHeader === 'string'
        ? userAgentHeader
        : Array.isArray(userAgentHeader) &&
            typeof userAgentHeader[0] === 'string'
          ? userAgentHeader[0]
          : null;

    return {
      deviceId: this.sanitizeNullable(deviceId, 128),
      ip: this.sanitizeNullable(req.ip || null, 64),
      userAgent: this.sanitizeNullable(userAgent, 512),
    };
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
}
