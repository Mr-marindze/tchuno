import { Injectable } from '@nestjs/common';
import { JobPricingMode, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const RECENT_JOBS_LIMIT = 8;

const adminOpsJobSelect = {
  id: true,
  title: true,
  status: true,
  pricingMode: true,
  clientId: true,
  workerProfileId: true,
  budget: true,
  quotedAmount: true,
  cancelReason: true,
  createdAt: true,
  acceptedAt: true,
  startedAt: true,
  completedAt: true,
  canceledAt: true,
  review: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.JobSelect;

type AdminOpsJobRecord = Prisma.JobGetPayload<{
  select: typeof adminOpsJobSelect;
}>;

type StatusSummary = Record<JobStatus, number>;
type PricingModeSummary = Record<JobPricingMode, number>;

const statusOrder: JobStatus[] = [
  'REQUESTED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELED',
];

const pricingModeOrder: JobPricingMode[] = ['FIXED_PRICE', 'QUOTE_REQUEST'];

@Injectable()
export class AdminOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      totalJobs,
      jobsByStatusRows,
      jobsByPricingModeRows,
      totalReviews,
      reviewsAggregate,
      activePublicableWorkers,
      recentJobs,
      recentlyCanceledJobs,
      completedWithoutReviewJobs,
    ] = await this.prisma.$transaction([
      this.prisma.job.count(),
      this.prisma.job.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.job.groupBy({
        by: ['pricingMode'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.review.count(),
      this.prisma.review.aggregate({
        _avg: {
          rating: true,
        },
      }),
      this.prisma.workerProfile.count({
        where: {
          isAvailable: true,
          hourlyRate: {
            gt: 0,
          },
          experienceYears: {
            gt: 0,
          },
          location: {
            not: null,
          },
          user: {
            isActive: true,
          },
          categories: {
            some: {
              category: {
                isActive: true,
              },
            },
          },
          NOT: [
            {
              location: '',
            },
          ],
        },
      }),
      this.prisma.job.findMany({
        select: adminOpsJobSelect,
        orderBy: [
          {
            createdAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
        take: RECENT_JOBS_LIMIT,
      }),
      this.prisma.job.findMany({
        where: {
          status: 'CANCELED',
        },
        select: adminOpsJobSelect,
        orderBy: [
          {
            canceledAt: 'desc',
          },
          {
            updatedAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
        take: RECENT_JOBS_LIMIT,
      }),
      this.prisma.job.findMany({
        where: {
          status: 'COMPLETED',
          review: null,
        },
        select: adminOpsJobSelect,
        orderBy: [
          {
            completedAt: 'desc',
          },
          {
            updatedAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
        take: RECENT_JOBS_LIMIT,
      }),
    ]);

    const jobsByStatus = this.buildStatusSummary(jobsByStatusRows);
    const jobsByPricingMode = this.buildPricingModeSummary(
      jobsByPricingModeRows,
    );
    const completedJobs = jobsByStatus.COMPLETED;
    const completionRate =
      totalJobs === 0
        ? 0
        : Number(((completedJobs / totalJobs) * 100).toFixed(1));
    const averageRating =
      reviewsAggregate._avg.rating === null
        ? 0
        : Number(reviewsAggregate._avg.rating.toFixed(2));

    return {
      kpis: {
        totalJobs,
        jobsByStatus,
        completionRate,
        totalReviews,
        averageRating,
        activePublicableWorkers,
        jobsByPricingMode,
      },
      recentJobs: recentJobs.map((item) => this.toJobListItem(item)),
      recentlyCanceledJobs: recentlyCanceledJobs.map((item) =>
        this.toJobListItem(item),
      ),
      completedWithoutReviewJobs: completedWithoutReviewJobs.map((item) =>
        this.toJobListItem(item),
      ),
    };
  }

  private buildStatusSummary(
    rows: Array<{
      status: JobStatus;
      _count: {
        _all: number;
      };
    }>,
  ): StatusSummary {
    const summary = this.createStatusSummary();

    for (const row of rows) {
      summary[row.status] = row._count._all;
    }

    return summary;
  }

  private createStatusSummary(): StatusSummary {
    return statusOrder.reduce<StatusSummary>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as StatusSummary);
  }

  private buildPricingModeSummary(
    rows: Array<{
      pricingMode: JobPricingMode;
      _count: {
        _all: number;
      };
    }>,
  ): PricingModeSummary {
    const summary = this.createPricingModeSummary();

    for (const row of rows) {
      summary[row.pricingMode] = row._count._all;
    }

    return summary;
  }

  private createPricingModeSummary(): PricingModeSummary {
    return pricingModeOrder.reduce<PricingModeSummary>((acc, pricingMode) => {
      acc[pricingMode] = 0;
      return acc;
    }, {} as PricingModeSummary);
  }

  private toJobListItem(item: AdminOpsJobRecord) {
    return {
      id: item.id,
      title: item.title,
      status: item.status,
      pricingMode: item.pricingMode,
      clientId: item.clientId,
      workerProfileId: item.workerProfileId,
      budget: item.budget,
      quotedAmount: item.quotedAmount,
      cancelReason: item.cancelReason,
      hasReview: Boolean(item.review),
      createdAt: item.createdAt,
      acceptedAt: item.acceptedAt,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      canceledAt: item.canceledAt,
    };
  }
}
