import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JobPricingMode, JobStatus, Prisma } from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { ProposeQuoteDto } from './dto/propose-quote.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  async create(clientId: string, dto: CreateJobDto) {
    const pricingMode = dto.pricingMode ?? 'FIXED_PRICE';
    const budget = dto.budget ?? null;

    if (pricingMode === 'FIXED_PRICE' && (budget === null || budget <= 0)) {
      this.auditWarn('job_create_invalid_fixed_price_budget', {
        clientId,
        budget,
      });
      throw new BadRequestException(
        'budget is required and must be > 0 for FIXED_PRICE jobs',
      );
    }

    if (pricingMode === 'QUOTE_REQUEST' && budget !== null && budget < 0) {
      this.auditWarn('job_create_invalid_quote_budget', {
        clientId,
        budget,
      });
      throw new BadRequestException(
        'budget must be >= 0 when provided for QUOTE_REQUEST jobs',
      );
    }

    const scheduledForDate = dto.scheduledFor
      ? new Date(dto.scheduledFor)
      : null;
    if (scheduledForDate && scheduledForDate.getTime() <= Date.now()) {
      this.auditWarn('job_create_invalid_schedule', {
        clientId,
        workerProfileId: dto.workerProfileId,
      });
      throw new BadRequestException('scheduledFor must be in the future');
    }

    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: { id: dto.workerProfileId },
      select: {
        id: true,
        isAvailable: true,
        location: true,
        hourlyRate: true,
        experienceYears: true,
      },
    });

    if (!workerProfile) {
      this.auditWarn('job_create_worker_not_found', {
        clientId,
        workerProfileId: dto.workerProfileId,
      });
      throw new NotFoundException('Worker profile not found');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, isActive: true },
    });

    if (!category || !category.isActive) {
      this.auditWarn('job_create_category_not_found', {
        clientId,
        categoryId: dto.categoryId,
      });
      throw new NotFoundException('Category not found');
    }

    if (!workerProfile.isAvailable) {
      this.auditWarn('job_create_worker_unavailable', {
        clientId,
        workerProfileId: dto.workerProfileId,
      });
      throw new ConflictException('Worker is not currently available');
    }

    const isWorkerProfileReady =
      !!workerProfile.location &&
      workerProfile.location.trim().length >= 3 &&
      typeof workerProfile.hourlyRate === 'number' &&
      workerProfile.hourlyRate > 0 &&
      workerProfile.experienceYears > 0;

    if (!isWorkerProfileReady) {
      this.auditWarn('job_create_worker_profile_incomplete', {
        clientId,
        workerProfileId: dto.workerProfileId,
      });
      throw new ConflictException(
        'Worker profile must include location, hourlyRate and experienceYears',
      );
    }

    const matchesCategory = await this.prisma.workerProfileCategory.findUnique({
      where: {
        workerProfileId_categoryId: {
          workerProfileId: dto.workerProfileId,
          categoryId: dto.categoryId,
        },
      },
      select: { workerProfileId: true },
    });

    if (!matchesCategory) {
      this.auditWarn('job_create_category_mismatch', {
        clientId,
        workerProfileId: dto.workerProfileId,
        categoryId: dto.categoryId,
      });
      throw new ConflictException(
        'Worker profile is not linked to this category',
      );
    }

    const job = await this.prisma.job.create({
      data: {
        clientId,
        workerProfileId: dto.workerProfileId,
        categoryId: dto.categoryId,
        pricingMode,
        title: dto.title.trim(),
        description: dto.description.trim(),
        budget,
        scheduledFor: scheduledForDate,
      },
    });

    this.audit('job_created', {
      jobId: job.id,
      clientId,
      workerProfileId: job.workerProfileId,
      pricingMode: job.pricingMode,
      status: job.status,
    });

    return job;
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

  async proposeQuote(jobId: string, requesterId: string, dto: ProposeQuoteDto) {
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

    const isWorker = job.workerProfile.userId === requesterId;
    if (!isWorker) {
      throw new ForbiddenException(
        'Only the assigned worker can propose quote',
      );
    }

    if (job.pricingMode !== 'QUOTE_REQUEST') {
      throw new ConflictException(
        'Quote proposal is only available for QUOTE_REQUEST jobs',
      );
    }

    if (job.status !== 'REQUESTED') {
      throw new ConflictException(
        'Quote proposal is only allowed while job is REQUESTED',
      );
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        quotedAmount: dto.quotedAmount,
        quoteMessage: dto.quoteMessage?.trim() || null,
      },
    });

    this.audit('job_quote_proposed', {
      jobId,
      requesterId,
      quotedAmount: dto.quotedAmount,
    });

    return updatedJob;
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

    if (
      job.requestId &&
      ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(next)
    ) {
      await this.assertExecutionPaymentReady(job.id);
    }

    if (
      !this.isTransitionAllowed(
        current,
        next,
        isClient,
        isWorker,
        job.pricingMode,
      )
    ) {
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

    if (next === 'ACCEPTED') {
      if (job.pricingMode === 'QUOTE_REQUEST') {
        if (!isClient) {
          throw new ConflictException(
            'Only client can accept a QUOTE_REQUEST proposal',
          );
        }

        if (job.quotedAmount === null) {
          this.auditWarn('job_status_quote_missing_on_accept', {
            jobId,
            requesterId,
          });
          throw new BadRequestException(
            'Worker quote proposal is required before accepting QUOTE_REQUEST jobs',
          );
        }

        if (
          dto.quotedAmount !== undefined &&
          dto.quotedAmount !== job.quotedAmount
        ) {
          throw new ConflictException(
            'quotedAmount does not match the latest worker proposal',
          );
        }
      } else if (dto.quotedAmount !== undefined) {
        throw new BadRequestException(
          'quotedAmount can only be provided for QUOTE_REQUEST jobs',
        );
      }
    }

    if (next !== 'ACCEPTED' && dto.quotedAmount !== undefined) {
      throw new BadRequestException(
        'quotedAmount can only be provided when status=ACCEPTED',
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

    if (next === 'ACCEPTED' && job.pricingMode === 'QUOTE_REQUEST') {
      data.quotedAmount = job.quotedAmount;
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
    pricingMode: JobPricingMode,
  ) {
    if (current === next) {
      return false;
    }

    if (current === 'COMPLETED' || current === 'CANCELED') {
      return false;
    }

    if (current === 'REQUESTED' && next === 'ACCEPTED') {
      if (pricingMode === 'QUOTE_REQUEST') {
        return isClient;
      }

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
