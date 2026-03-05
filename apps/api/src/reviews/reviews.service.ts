import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new NotFoundException('Job not found');
    }

    if (job.clientId !== reviewerId) {
      throw new ForbiddenException('Only the job client can review this job');
    }

    if (job.status !== 'COMPLETED') {
      throw new ConflictException('Only completed jobs can be reviewed');
    }

    const existing = await this.prisma.review.findUnique({
      where: { jobId: dto.jobId },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('This job already has a review');
    }

    return this.prisma.$transaction(async (tx) => {
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
  }

  async listByWorkerProfile(workerProfileId: string) {
    return this.prisma.review.findMany({
      where: { workerProfileId },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async listMine(reviewerId: string) {
    return this.prisma.review.findMany({
      where: { reviewerId },
      orderBy: [{ createdAt: 'desc' }],
    });
  }
}
