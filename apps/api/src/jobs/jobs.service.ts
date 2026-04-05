import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  createDeprecated(actorUserId: string) {
    this.auditWarn('job_create_deprecated_endpoint_blocked', {
      actorUserId,
    });

    throw new GoneException(
      'Direct job creation was removed. Use ServiceRequest -> Proposal -> Selection flow.',
    );
  }

  proposeQuoteDeprecated(jobId: string, actorUserId: string) {
    this.auditWarn('job_quote_deprecated_endpoint_blocked', {
      jobId,
      actorUserId,
    });

    throw new GoneException(
      'Direct quote on job was removed. Providers must submit proposals on service requests.',
    );
  }

  async getById(jobId: string, requesterId: string) {
    const jobAccess = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        workerProfile: {
          select: {
            userId: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
        provider: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!jobAccess) {
      throw new NotFoundException('Job not found');
    }

    const jobProviderId =
      jobAccess.providerId ?? jobAccess.workerProfile.userId;
    if (jobAccess.clientId !== requesterId && jobProviderId !== requesterId) {
      throw new ForbiddenException('You are not allowed to access this job');
    }

    const [job, paidIntent] = await this.prisma.$transaction([
      this.prisma.job.findUniqueOrThrow({
        where: { id: jobId },
      }),
      this.prisma.paymentIntent.findFirst({
        where: {
          jobId,
          status: {
            in: ['PAID_PARTIAL', 'SUCCEEDED'],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
        },
      }),
    ]);

    const contactUnlocked = Boolean(job.contactUnlockedAt || paidIntent);
    const providerEmail =
      jobAccess.provider?.email ?? jobAccess.workerProfile.user.email ?? null;
    const providerName =
      jobAccess.provider?.name ?? jobAccess.workerProfile.user.name ?? null;

    return {
      ...job,
      contactUnlocked,
      providerContact: contactUnlocked
        ? {
            email: providerEmail,
            name: providerName,
          }
        : null,
      paymentRequired: !contactUnlocked,
      paymentStatus: paidIntent ? 'PAID_PARTIAL' : 'AWAITING_PAYMENT',
    };
  }

  private async assertExecutionPaymentReady(jobId: string) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: {
        jobId,
        status: {
          in: ['PAID_PARTIAL', 'SUCCEEDED'],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
      },
    });

    if (!intent) {
      throw new ConflictException(
        'Deposit payment is required before provider execution workflow',
      );
    }
  }

  async listMyClientJobs(clientId: string, query: ListJobsQueryDto) {
    const { page, limit, skip } = resolvePagination(query);
    const where = this.buildListWhere({ clientId }, query);
    const sort = query.sort ?? 'createdAt:desc';

    const [total, data] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        orderBy: this.buildOrderBy(sort),
        take: limit,
        skip,
      }),
    ]);

    return buildPaginatedResponse({
      data,
      total,
      page,
      limit,
    });
  }

  async listMyWorkerJobs(userId: string, query: ListJobsQueryDto) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Worker profile not found');
    }

    const { page, limit, skip } = resolvePagination(query);
    const where = this.buildListWhere({ workerProfileId: profile.id }, query);
    const sort = query.sort ?? 'createdAt:desc';

    const [total, data] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        orderBy: this.buildOrderBy(sort),
        take: limit,
        skip,
      }),
    ]);

    return buildPaginatedResponse({
      data,
      total,
      page,
      limit,
    });
  }

  async updateStatus(
    jobId: string,
    requesterId: string,
    dto: UpdateJobStatusDto,
  ) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        workerProfile: {
          select: { userId: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const isClient = job.clientId === requesterId;
    const isWorker = job.workerProfile.userId === requesterId;

    if (!isClient && !isWorker) {
      throw new ForbiddenException('You are not allowed to update this job');
    }

    const current = job.status;
    const next = dto.status as JobStatus;

    if (['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(next)) {
      if (!job.requestId || !job.proposalId) {
        throw new ConflictException(
          'Legacy direct jobs cannot progress. Use ServiceRequest -> Proposal -> Selection flow.',
        );
      }

      await this.assertExecutionPaymentReady(job.id);
    }

    if (!this.isTransitionAllowed(current, next, isClient, isWorker)) {
      this.auditWarn('job_status_transition_rejected', {
        jobId,
        requesterId,
        from: current,
        to: next,
      });

      this.metricsService.recordJobStatusTransition({
        from: current,
        to: next,
        result: 'failed',
      });

      throw new ConflictException(
        `Invalid transition from ${current} to ${next}`,
      );
    }

    if (next !== 'CANCELED' && dto.cancelReason) {
      throw new BadRequestException(
        'cancelReason can only be provided when status=CANCELED',
      );
    }

    const data: Prisma.JobUpdateInput = {
      status: next,
    };

    if (next === 'ACCEPTED' && !job.acceptedAt) {
      data.acceptedAt = new Date();
    }

    if (next === 'IN_PROGRESS' && !job.startedAt) {
      data.startedAt = new Date();
    }

    if (next === 'COMPLETED' && !job.completedAt) {
      data.completedAt = new Date();
    }

    if (next === 'CANCELED') {
      const cancelReason = dto.cancelReason?.trim();
      if (!cancelReason) {
        throw new BadRequestException(
          'cancelReason is required when status=CANCELED',
        );
      }

      if (!job.canceledAt) {
        data.canceledAt = new Date();
      }
      data.canceledBy = requesterId;
      data.cancelReason = cancelReason;
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data,
    });

    this.metricsService.recordJobStatusTransition({
      from: current,
      to: next,
      result: 'success',
    });

    this.audit('job_status_transition_success', {
      jobId,
      requesterId,
      from: current,
      to: next,
    });

    return updatedJob;
  }

  private buildListWhere(
    baseWhere: Prisma.JobWhereInput,
    query: ListJobsQueryDto,
  ): Prisma.JobWhereInput {
    const normalizedSearch = query.search?.trim();

    return {
      ...baseWhere,
      ...(query.status ? { status: query.status } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              {
                title: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(sort: string): Prisma.JobOrderByWithRelationInput[] {
    const [sortField, sortDirection] = sort.split(':') as [
      'createdAt' | 'budget',
      Prisma.SortOrder,
    ];

    if (sortField === 'budget') {
      return [{ budget: sortDirection }, { createdAt: 'desc' }, { id: 'desc' }];
    }

    return [{ createdAt: sortDirection }, { id: 'desc' }];
  }

  private isTransitionAllowed(
    current: JobStatus,
    next: JobStatus,
    isClient: boolean,
    isWorker: boolean,
  ) {
    if (current === next) {
      return false;
    }

    if (current === 'COMPLETED' || current === 'CANCELED') {
      return false;
    }

    if (current === 'REQUESTED' && next === 'ACCEPTED') {
      return isWorker;
    }

    if (isWorker && current === 'ACCEPTED' && next === 'IN_PROGRESS') {
      return true;
    }

    if (isWorker && current === 'IN_PROGRESS' && next === 'COMPLETED') {
      return true;
    }

    if (isClient && next === 'CANCELED') {
      return true;
    }

    return false;
  }

  private audit(event: string, context: Record<string, unknown>): void {
    this.metricsService.recordBusinessEvent({
      domain: 'jobs',
      event,
      result: 'success',
    });

    this.logger.log(
      JSON.stringify({
        event,
        ...context,
      }),
    );
  }

  private auditWarn(event: string, context: Record<string, unknown>): void {
    this.metricsService.recordBusinessEvent({
      domain: 'jobs',
      event,
      result: 'blocked',
    });

    this.logger.warn(
      JSON.stringify({
        event,
        ...context,
      }),
    );
  }
}
