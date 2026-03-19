import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListWorkerProfilesQueryDto } from './dto/list-worker-profiles-query.dto';
import { UpdateWorkerProfileDto } from './dto/update-worker-profile.dto';
import { UpsertWorkerProfileDto } from './dto/upsert-worker-profile.dto';
import { WorkerProfileListResponseDto } from './dto/worker-profile-list-response.dto';
import { WorkerProfileDto } from './dto/worker-profile.dto';
import { WorkerProfileService } from './worker-profile.service';

type AuthenticatedRequest = {
  user: { sub: string; email: string };
};

@ApiTags('worker-profile')
@Controller('worker-profile')
export class WorkerProfileController {
  constructor(private readonly workerProfileService: WorkerProfileService) {}

  @Get()
  @ApiOperation({ summary: 'List worker profiles' })
  @ApiOkResponse({ type: WorkerProfileListResponseDto })
  list(@Query() query: ListWorkerProfilesQueryDto) {
    return this.workerProfileService.list(query);
  }

  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user worker profile' })
  @ApiOkResponse({ type: WorkerProfileDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('provider.profile.manage')
  getMe(@Req() req: AuthenticatedRequest) {
    return this.workerProfileService.getMe(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @Put('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or replace current user worker profile' })
  @ApiOkResponse({ type: WorkerProfileDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @RequirePermissions('provider.profile.manage')
  upsertMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpsertWorkerProfileDto,
  ) {
    return this.workerProfileService.upsertMe(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Update current user worker profile' })
  @ApiOkResponse({ type: WorkerProfileDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @RequirePermissions('provider.profile.manage')
  updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateWorkerProfileDto,
  ) {
    return this.workerProfileService.updateMe(req.user.sub, dto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get public worker profile by user id' })
  @ApiParam({ name: 'userId', type: String })
  @ApiOkResponse({ type: WorkerProfileDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  getByUserId(@Param('userId') userId: string) {
    return this.workerProfileService.getPublicByUserId(userId);
  }
}
