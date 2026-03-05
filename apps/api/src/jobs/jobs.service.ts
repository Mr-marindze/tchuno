import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(clientId: string, dto: CreateJobDto) {
    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: { id: dto.workerProfileId },
      select: { id: true, isAvailable: true },
    });

    if (!workerProfile) {
      throw new NotFoundException('Worker profile not found');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, isActive: true },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException('Category not found');
    }

    if (!workerProfile.isAvailable) {
      throw new ConflictException('Worker is not currently available');
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
      throw new ConflictException(
        'Worker profile is not linked to this category',
      );
    }

    return this.prisma.job.create({
      data: {
        clientId,
        workerProfileId: dto.workerProfileId,
        categoryId: dto.categoryId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        budget: dto.budget,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
      },
    });
  }

  async getById(jobId: string, requesterId: string) {
    const jobAccess = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        workerProfile: {
          select: { userId: true },
        },
      },
    });

    if (!jobAccess) {
      throw new NotFoundException('Job not found');
    }

    if (
      jobAccess.clientId !== requesterId &&
      jobAccess.workerProfile.userId !== requesterId
    ) {
      throw new ForbiddenException('You are not allowed to access this job');
    }

    return this.prisma.job.findUniqueOrThrow({
      where: { id: jobId },
    });
  }

  async listMyClientJobs(clientId: string, query: ListJobsQueryDto) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    return this.prisma.job.findMany({
      where: {
        clientId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: offset,
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

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    return this.prisma.job.findMany({
      where: {
        workerProfileId: profile.id,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: offset,
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

    if (!this.isTransitionAllowed(current, next, isClient, isWorker)) {
      throw new ConflictException(
        `Invalid transition from ${current} to ${next}`,
      );
    }

    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: next,
        completedAt: next === 'COMPLETED' ? new Date() : null,
        canceledAt: next === 'CANCELED' ? new Date() : null,
      },
    });
  }

  private isTransitionAllowed(
    current: JobStatus,
    next: JobStatus,
    isClient: boolean,
    isWorker: boolean,
  ) {
    if (current === next) {
      return true;
    }

    if (current === 'COMPLETED' || current === 'CANCELED') {
      return false;
    }

    if (isWorker) {
      if (current === 'REQUESTED' && next === 'ACCEPTED') {
        return true;
      }

      if (current === 'ACCEPTED' && next === 'IN_PROGRESS') {
        return true;
      }

      if (current === 'IN_PROGRESS' && next === 'COMPLETED') {
        return true;
      }
    }

    if (isClient) {
      if (next === 'CANCELED') {
        return current !== 'COMPLETED';
      }
    }

    return false;
  }
}
