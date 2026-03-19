import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';

export class TrackingWorkerRankingItemDto {
  @ApiProperty({ example: 'cmf9kz8ju00053fwwj6v9xfrf' })
  workerProfileId!: string;

  @ApiProperty({ example: 15.42 })
  score!: number;

  @ApiProperty({ example: 6.12 })
  qualityComponent!: number;

  @ApiProperty({ example: 9.3 })
  behaviorComponent!: number;

  @ApiProperty({ example: 0.92 })
  stabilityMultiplier!: number;

  @ApiProperty({ example: 0.88 })
  decayMultiplier!: number;

  @ApiProperty({ example: 14 })
  interactions!: number;

  @ApiProperty({ example: 8 })
  clicks!: number;

  @ApiProperty({ example: 4 })
  ctaClicks!: number;

  @ApiProperty({ example: 2 })
  conversions!: number;

  @ApiProperty({ example: 4.8 })
  ratingAvg!: number;

  @ApiProperty({ example: 12 })
  ratingCount!: number;

  @ApiProperty({ example: true })
  isAvailable!: boolean;

  @ApiProperty({ example: '2026-03-18T18:30:00.000Z', nullable: true })
  lastEventAt!: string | null;
}

export class TrackingWorkerRankingListResponseDto {
  @ApiProperty({ type: TrackingWorkerRankingItemDto, isArray: true })
  data!: TrackingWorkerRankingItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
