import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AppRole } from '../auth/authorization.types';
import { RequireAppRoles } from '../auth/decorators/require-app-roles.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminActionAuditInterceptor } from '../auth/interceptors/admin-action-audit.interceptor';
import { CreateOperationalIncidentDto } from './dto/create-operational-incident.dto';
import { ListOperationalIncidentsQueryDto } from './dto/list-operational-incidents-query.dto';
import { UpdateOperationalIncidentDto } from './dto/update-operational-incident.dto';
import { SupportOpsService } from './support-ops.service';

type AdminRequest = {
  user: {
    sub: string;
  };
  authz?: {
    role?: AppRole;
  };
};

@ApiTags('admin-support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@UseInterceptors(AdminActionAuditInterceptor)
@RequireAppRoles('admin', 'ops_admin', 'support_admin', 'super_admin')
@Controller('admin/support')
export class SupportOpsController {
  constructor(private readonly supportOpsService: SupportOpsService) {}

  @Get('incidents')
  @ApiOperation({ summary: 'List operational incidents' })
  @ApiOkResponse({ description: 'Operational incidents loaded' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.ops.read')
  listIncidents(@Query() query: ListOperationalIncidentsQueryDto) {
    return this.supportOpsService.listIncidents(query);
  }

  @Post('incidents')
  @ApiOperation({ summary: 'Create a new operational incident' })
  @ApiOkResponse({ description: 'Operational incident created' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.support.manage')
  createIncident(
    @Req() req: AdminRequest,
    @Body() dto: CreateOperationalIncidentDto,
  ) {
    return this.supportOpsService.createIncident(req.user.sub, dto);
  }

  @Patch('incidents/:id')
  @ApiOperation({ summary: 'Update operational incident status or notes' })
  @ApiOkResponse({ description: 'Operational incident updated' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.support.manage')
  updateIncident(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: UpdateOperationalIncidentDto,
  ) {
    return this.supportOpsService.updateIncident(id, req.user.sub, dto);
  }
}
