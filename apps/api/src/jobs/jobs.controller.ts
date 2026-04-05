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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RequireAppRoles } from '../auth/decorators/require-app-roles.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { AccessPolicyGuard } from '../auth/guards/access-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JobListResponseDto } from './dto/job-list-response.dto';
import { JobDto } from './dto/job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobsService } from './jobs.service';

type AuthenticatedRequest = {
  user: { sub: string; email: string };
};

@ApiTags('jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'DEPRECATED: direct job creation is disabled, use service request flow',
    deprecated: true,
  })
  @ApiGoneResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @RequireAppRoles(
    'customer',
    'admin',
    'ops_admin',
    'support_admin',
    'super_admin',
  )
  create(@Req() req: AuthenticatedRequest) {
    return this.jobsService.createDeprecated(req.user.sub);
  }

  @Get('me/client')
  @ApiOperation({ summary: 'List jobs where current user is the client' })
  @ApiOkResponse({ type: JobListResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.jobs.read.own')
  listMyClientJobs(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListJobsQueryDto,
  ) {
    return this.jobsService.listMyClientJobs(req.user.sub, query);
  }

  @Get('me/worker')
  @ApiOperation({ summary: 'List jobs assigned to current worker profile' })
  @ApiOkResponse({ type: JobListResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('provider.jobs.read.own')
  listMyWorkerJobs(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListJobsQueryDto,
  ) {
    return this.jobsService.listMyWorkerJobs(req.user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one job by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: JobDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @RequirePermissions('customer.jobs.read.own')
  getById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.jobsService.getById(id, req.user.sub);
  }

  @Patch(':id/quote')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'DEPRECATED: direct quote proposal on job is disabled, use proposals on service requests',
    deprecated: true,
  })
  @ApiParam({ name: 'id', type: String })
  @ApiGoneResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @RequireAppRoles(
    'provider',
    'admin',
    'ops_admin',
    'support_admin',
    'super_admin',
  )
  proposeQuote(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.jobsService.proposeQuoteDeprecated(id, req.user.sub);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiOperation({ summary: 'Update job status with transition rules' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: JobDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @RequireAppRoles(
    'customer',
    'provider',
    'admin',
    'ops_admin',
    'support_admin',
    'super_admin',
  )
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.jobsService.updateStatus(id, req.user.sub, dto);
  }
}
