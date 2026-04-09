import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
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
import { ListTrustSafetyInterventionsQueryDto } from './dto/list-trust-safety-interventions-query.dto';
import { ReviewTrustSafetyInterventionDto } from './dto/review-trust-safety-intervention.dto';
import { TrustSafetyService } from './trust-safety.service';

type AuthenticatedRequest = {
  user: { sub: string };
  authz?: {
    role?: AppRole;
  };
};

@ApiTags('admin-trust-safety')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@RequireAppRoles('admin', 'support_admin', 'ops_admin', 'super_admin')
@Controller('admin/trust-safety')
export class AdminTrustSafetyController {
  constructor(private readonly trustSafetyService: TrustSafetyService) {}

  @Get('interventions')
  @ApiOperation({ summary: 'List trust & safety interventions for review' })
  @ApiOkResponse({ description: 'Interventions loaded' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.moderation.manage')
  list(@Query() query: ListTrustSafetyInterventionsQueryDto) {
    return this.trustSafetyService.adminListInterventions(query);
  }

  @Post('interventions/:id/review')
  @ApiOperation({ summary: 'Review a trust & safety intervention' })
  @ApiOkResponse({ description: 'Intervention reviewed' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @RequirePermissions('admin.moderation.manage')
  review(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReviewTrustSafetyInterventionDto,
  ) {
    return this.trustSafetyService.reviewIntervention(id, req.user.sub, dto);
  }
}
