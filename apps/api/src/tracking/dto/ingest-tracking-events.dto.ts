import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class TrackingEventMetadataDto {
  @ApiPropertyOptional({ example: 'cmf9kz8ju00053fwwj6v9xfrf' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  workerId?: string;

  @ApiPropertyOptional({ example: 'cmf9kz8ju00053fwwj6v9xfrf' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  workerProfileId?: string;

  @ApiPropertyOptional({ example: 'canalizacao' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  categorySlug?: string;

  @ApiPropertyOptional({ example: 'landing.discovery' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  source?: string;
}

export class TrackingEventItemDto {
  @ApiProperty({ example: 'marketplace.worker.card.click' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: '2026-03-18T18:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  timestamp?: string;

  @ApiPropertyOptional({ type: TrackingEventMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TrackingEventMetadataDto)
  metadata?: TrackingEventMetadataDto;
}

export class IngestTrackingEventsDto {
  @ApiPropertyOptional({ example: 'sess_c3bd...' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @ApiPropertyOptional({ example: '2026-03-18T18:30:02.000Z' })
  @IsOptional()
  @IsISO8601()
  sentAt?: string;

  @ApiProperty({ type: TrackingEventItemDto, isArray: true, maxItems: 200 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TrackingEventItemDto)
  events!: TrackingEventItemDto[];
}

export class IngestTrackingEventsResponseDto {
  @ApiProperty({ example: 12 })
  accepted!: number;

  @ApiProperty({ example: 12 })
  queued!: number;

  @ApiProperty({ example: 0 })
  dropped!: number;
}
