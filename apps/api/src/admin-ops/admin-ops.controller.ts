import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOpsService } from './admin-ops.service';
import { AdminOpsOverviewDto } from './dto/admin-ops-overview.dto';

@ApiTags('admin-ops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminRoleGuard)
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
