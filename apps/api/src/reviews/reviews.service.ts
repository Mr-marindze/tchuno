import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildPaginatedResponse,
  resolvePagination,
} from '../common/pagination/pagination';
import { MetricsService } from '../observability/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  async create(reviewerId: string, dto: CreateReviewDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: {
        id: true,
        clientId: true,
        workerProfileId: true,
        status: true,
      },
    });

    if (!job) {
      this.auditWarn('review_create_job_not_found', {
        reviewerId,
        jobId: dto.jobId,
      });
      throw new NotFoundException('Job not found');
    }

    if (job.clientId !== reviewerId) {
      this.auditWarn('review_create_forbidden_reviewer', {
        reviewerId,
        jobId: dto.jobId,
      });
      throw new ForbiddenException('Only the job client can review this job');
    }

    if (job.status !== 'COMPLETED') {
      this.auditWarn('review_create_job_not_completed', {
        reviewerId,
        jobId: dto.jobId,
        jobStatus: job.status,
      });
      throw new ConflictException('Only completed jobs can be reviewed');
    }

    const existing = await this.prisma.review.findUnique({
      where: { jobId: dto.jobId },
      select: { id: true },
    });

    if (existing) {
      this.auditWarn('review_create_duplicate', {
        reviewerId,
        jobId: dto.jobId,
      });
      throw new ConflictException('This job already has a review');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          jobId: dto.jobId,
          workerProfileId: job.workerProfileId,
          reviewerId,
          rating: dto.rating,
          comment: dto.comment?.trim() || null,
        },
      });

      const aggregates = await tx.review.aggregate({
        where: { workerProfileId: job.workerProfileId },
        _avg: { rating: true },
        _count: { _all: true },
      });

      const avg = aggregates._avg.rating ?? 0;
      const count = aggregates._count._all;

      await tx.workerProfile.update({
        where: { id: job.workerProfileId },
        data: {
          ratingAvg: new Prisma.Decimal(avg.toFixed(2)),
          ratingCount: count,
        },
      });

      return review;
    });

    this.audit('review_created', {
      reviewId: review.id,
      jobId: review.jobId,
      workerProfileId: review.workerProfileId,
      reviewerId,
      rating: review.rating,
    });

    return review;
  }

  async listByWorkerProfile(
    workerProfileId: string,
    query: ListReviewsQueryDto,
  ) {
    const { page, limit, skip } = resolvePagination(query);
    const where = this.buildWhere({ workerProfileId }, query);
    const sort = query.sort ?? 'createdAt:desc';

    const [total, data] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
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

  async listMine(reviewerId: string, query: ListReviewsQueryDto) {
    const { page, limit, skip } = resolvePagination(query);
    const where = this.buildWhere({ reviewerId }, query);
    const sort = query.sort ?? 'createdAt:desc';

    const [total, data] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
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

  private buildWhere(
    baseWhere: Prisma.ReviewWhereInput,
    query: ListReviewsQueryDto,
  ): Prisma.ReviewWhereInput {
    return {
      ...baseWhere,
      ...(query.rating !== undefined ? { rating: query.rating } : {}),
    };
  }

  private buildOrderBy(sort: string): Prisma.ReviewOrderByWithRelationInput[] {
    const [sortField, sortDirection] = sort.split(':') as [
      'createdAt' | 'rating',
      Prisma.SortOrder,
    ];

    if (sortField === 'rating') {
      return [{ rating: sortDirection }, { createdAt: 'desc' }, { id: 'desc' }];
    }

    return [{ createdAt: sortDirection }, { id: 'desc' }];
  }

  private audit(event: string, context: Record<string, unknown>): void {
    this.metricsService.recordBusinessEvent({
      domain: 'reviews',
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
      domain: 'reviews',
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
