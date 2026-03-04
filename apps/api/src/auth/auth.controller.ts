import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionDto } from './dto/session.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionClientInfo } from './types';

type AuthenticatedRequest = {
  user: { sub: string; email: string };
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.extractClientInfo(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.extractClientInfo(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.extractClientInfo(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout by revoking refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiNoContentResponse({ description: 'Successfully logged out' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout all devices by revoking all refresh tokens' })
  @ApiNoContentResponse({ description: 'All sessions revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  logoutAll(@Req() req: AuthenticatedRequest) {
    return this.authService.logoutAll(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiOperation({ summary: 'List user sessions/devices' })
  @ApiOkResponse({ type: SessionDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  sessions(@Req() req: AuthenticatedRequest) {
    return this.authService.listSessions(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke one specific session/device' })
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse({ description: 'Session revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  revokeSession(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.authService.revokeSession(req.user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user payload from access token' })
  @ApiOkResponse({ description: 'Current user payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  me(@Req() req: AuthenticatedRequest) {
    return req.user;
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
        : Array.isArray(userAgentHeader) && typeof userAgentHeader[0] === 'string'
          ? userAgentHeader[0]
          : null;

    return {
      deviceId,
      ip: req.ip || null,
      userAgent,
    };
  }
}
