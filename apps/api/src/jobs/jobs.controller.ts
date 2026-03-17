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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErrorResponseDto } from '../auth/dto/error-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateJobDto } from './dto/create-job.dto';
import { JobDto } from './dto/job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobsService } from './jobs.service';

type AuthenticatedRequest = {
  user: { sub: string; email: string };
};

@ApiTags('jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a new job request' })
  @ApiOkResponse({ type: JobDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateJobDto) {
    return this.jobsService.create(req.user.sub, dto);
  }

  @Get('me/client')
  @ApiOperation({ summary: 'List jobs where current user is the client' })
  @ApiOkResponse({ type: JobDto, isArray: true })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  listMyClientJobs(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListJobsQueryDto,
  ) {
    return this.jobsService.listMyClientJobs(req.user.sub, query);
  }

  @Get('me/worker')
  @ApiOperation({ summary: 'List jobs assigned to current worker profile' })
  @ApiOkResponse({ type: JobDto, isArray: true })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
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
  getById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.jobsService.getById(id, req.user.sub);
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
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.jobsService.updateStatus(id, req.user.sub, dto);
  }
}
