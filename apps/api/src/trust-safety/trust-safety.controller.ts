import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequireAppRoles } from '../auth/decorators/require-app-roles.decorator';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppealTrustSafetyInterventionDto } from './dto/appeal-trust-safety-intervention.dto';
import { TrustSafetyService } from './trust-safety.service';

type AuthenticatedRequest = {
  user: { sub: string; email: string };
};

@ApiTags('trust-safety')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@RequireAppRoles(
  'customer',
  'provider',
  'admin',
  'support_admin',
  'ops_admin',
  'super_admin',
)
@Controller('trust-safety')
export class TrustSafetyController {
  constructor(private readonly trustSafetyService: TrustSafetyService) {}

  @Post('interventions/:id/appeal')
  @ApiOperation({ summary: 'Appeal a trust & safety intervention' })
  @ApiOkResponse({ description: 'Appeal registered' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  appeal(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AppealTrustSafetyInterventionDto,
  ) {
    return this.trustSafetyService.appealIntervention(id, req.user.sub, dto);
  }
}
