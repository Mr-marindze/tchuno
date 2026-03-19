import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AppRole } from '../auth/authorization.types';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireReauth } from '../auth/decorators/require-reauth.decorator';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { RequireAppRoles } from '../auth/decorators/require-app-roles.decorator';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminActionAuditInterceptor } from '../auth/interceptors/admin-action-audit.interceptor';
import { AdminOpsService } from './admin-ops.service';
import { AdminExportUsersResponseDto } from './dto/admin-export-users-response.dto';
import { AdminManagedUserDto } from './dto/admin-managed-user.dto';
import { AdminOpsOverviewDto } from './dto/admin-ops-overview.dto';
import { AuditLogListResponseDto } from './dto/audit-log.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { PlatformSettingDto } from './dto/platform-setting.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpsertPlatformSettingDto } from './dto/upsert-platform-setting.dto';

type AdminRequest = {
  method: string;
  originalUrl?: string;
  path: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  user: {
    sub: string;
  };
  authz?: {
    role?: AppRole;
  };
};

@ApiTags('admin-ops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@UseInterceptors(AdminActionAuditInterceptor)
@RequireAppRoles('admin', 'ops_admin', 'support_admin', 'super_admin')
@Controller('admin/ops')
export class AdminOpsController {
  constructor(private readonly adminOpsService: AdminOpsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Admin operational snapshot for MVP pilot' })
  @ApiOkResponse({ type: AdminOpsOverviewDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  getOverview() {
    return this.adminOpsService.getOverview();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List persisted security and admin audit logs' })
  @ApiOkResponse({ type: AuditLogListResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.audit.read')
  listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.adminOpsService.listAuditLogs(query);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role/subrole (critical action)' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AdminManagedUserDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.roles.manage')
  @RequireReauth('admin.user.role.change')
  updateUserRole(
    @Req() req: AdminRequest,
    @Param('id') targetUserId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminOpsService.updateUserRole({
      targetUserId,
      role: dto.role,
      adminSubrole: dto.adminSubrole,
      actor: this.extractActor(req),
    });
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Suspend/reactivate user (critical action)' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: AdminManagedUserDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.users.manage')
  @RequireReauth('admin.user.status.change')
  updateUserStatus(
    @Req() req: AdminRequest,
    @Param('id') targetUserId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminOpsService.updateUserStatus({
      targetUserId,
      isActive: dto.isActive,
      actor: this.extractActor(req),
    });
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user account (critical action)' })
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.users.manage')
  @RequireReauth('admin.user.delete')
  async deleteUser(
    @Req() req: AdminRequest,
    @Param('id') targetUserId: string,
  ) {
    await this.adminOpsService.deleteUser({
      targetUserId,
      actor: this.extractActor(req),
    });
  }

  @Post('exports/users')
  @ApiOperation({ summary: 'Export users snapshot (critical action)' })
  @ApiOkResponse({ type: AdminExportUsersResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.reports.read')
  @RequireReauth('admin.data.export')
  exportUsersSnapshot(@Req() req: AdminRequest) {
    return this.adminOpsService.exportUsersSnapshot({
      actor: this.extractActor(req),
    });
  }

  @Put('settings/:key')
  @ApiOperation({ summary: 'Upsert global platform setting (critical action)' })
  @ApiParam({ name: 'key', type: String })
  @ApiOkResponse({ type: PlatformSettingDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.settings.manage')
  @RequireReauth('admin.setting.change')
  upsertPlatformSetting(
    @Req() req: AdminRequest,
    @Param('key') key: string,
    @Body() dto: UpsertPlatformSettingDto,
  ) {
    return this.adminOpsService.upsertPlatformSetting({
      key,
      value: dto.value,
      actor: this.extractActor(req),
    });
  }

  private extractActor(req: AdminRequest) {
    const userAgentHeader = req.headers?.['user-agent'];
    const userAgent = Array.isArray(userAgentHeader)
      ? (userAgentHeader[0] ?? null)
      : (userAgentHeader ?? null);

    return {
      userId: req.user.sub,
      role: req.authz?.role ?? 'admin',
      method: req.method,
      path: req.originalUrl ?? req.path,
      ipAddress: req.ip ?? null,
      userAgent: typeof userAgent === 'string' ? userAgent : null,
    } as const;
  }
}
