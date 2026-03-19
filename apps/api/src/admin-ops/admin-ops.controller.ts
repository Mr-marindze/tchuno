import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { RequireAppRoles } from '../auth/decorators/require-app-roles.decorator';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminActionAuditInterceptor } from '../auth/interceptors/admin-action-audit.interceptor';
import { AdminOpsService } from './admin-ops.service';
import { AdminOpsOverviewDto } from './dto/admin-ops-overview.dto';

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
}
