import { ApiProperty } from '@nestjs/swagger';
import { JobPricingMode, JobStatus } from '@prisma/client';

export class AdminOpsJobStatusSummaryDto {
  @ApiProperty({ example: 12 })
  REQUESTED!: number;

  @ApiProperty({ example: 9 })
  ACCEPTED!: number;

  @ApiProperty({ example: 5 })
  IN_PROGRESS!: number;

  @ApiProperty({ example: 24 })
  COMPLETED!: number;

  @ApiProperty({ example: 3 })
  CANCELED!: number;
}

export class AdminOpsPricingModeSummaryDto {
  @ApiProperty({ example: 22 })
  FIXED_PRICE!: number;

  @ApiProperty({ example: 31 })
  QUOTE_REQUEST!: number;
}

export class AdminOpsKpisDto {
  @ApiProperty({ example: 53 })
  totalJobs!: number;

  @ApiProperty({ type: AdminOpsJobStatusSummaryDto })
  jobsByStatus!: AdminOpsJobStatusSummaryDto;

  @ApiProperty({ example: 45.3 })
  completionRate!: number;

  @ApiProperty({ example: 41 })
  totalReviews!: number;

  @ApiProperty({ example: 4.47 })
  averageRating!: number;

  @ApiProperty({ example: 17 })
  activePublicableWorkers!: number;

  @ApiProperty({ type: AdminOpsPricingModeSummaryDto })
  jobsByPricingMode!: AdminOpsPricingModeSummaryDto;
}

export class AdminOpsJobListItemDto {
  @ApiProperty({ example: 'cm8abc123xyz' })
  id!: string;

  @ApiProperty({ example: 'Reparar fuga na cozinha' })
  title!: string;

  @ApiProperty({ enum: JobStatus })
  status!: JobStatus;

  @ApiProperty({ enum: JobPricingMode })
  pricingMode!: JobPricingMode;

  @ApiProperty({ example: 'cm8client123', description: 'Client user id' })
  clientId!: string;

  @ApiProperty({
    example: 'cm8workerprofile123',
    description: 'Worker profile id',
  })
  workerProfileId!: string;

  @ApiProperty({ example: 4500, nullable: true })
  budget!: number | null;

  @ApiProperty({ example: 5200, nullable: true })
  quotedAmount!: number | null;

  @ApiProperty({ example: 'Cliente desistiu do serviço', nullable: true })
  cancelReason!: string | null;

  @ApiProperty({ example: true })
  hasReview!: boolean;

  @ApiProperty({ example: '2026-03-18T08:22:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-03-18T09:10:00.000Z', nullable: true })
  acceptedAt!: Date | null;

  @ApiProperty({ example: '2026-03-18T11:00:00.000Z', nullable: true })
  startedAt!: Date | null;

  @ApiProperty({ example: '2026-03-18T13:45:00.000Z', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ example: '2026-03-18T10:05:00.000Z', nullable: true })
  canceledAt!: Date | null;
}

export class AdminOpsOverviewDto {
  @ApiProperty({ type: AdminOpsKpisDto })
  kpis!: AdminOpsKpisDto;

  @ApiProperty({ type: AdminOpsJobListItemDto, isArray: true })
  recentJobs!: AdminOpsJobListItemDto[];

  @ApiProperty({ type: AdminOpsJobListItemDto, isArray: true })
  recentlyCanceledJobs!: AdminOpsJobListItemDto[];

  @ApiProperty({ type: AdminOpsJobListItemDto, isArray: true })
  completedWithoutReviewJobs!: AdminOpsJobListItemDto[];
}
