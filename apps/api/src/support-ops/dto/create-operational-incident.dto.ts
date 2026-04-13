import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  OperationalIncidentSeverity,
  OperationalIncidentSource,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOperationalIncidentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(600)
  summary!: string;

  @ApiPropertyOptional({ enum: OperationalIncidentSource })
  @IsOptional()
  @IsEnum(OperationalIncidentSource)
  source?: OperationalIncidentSource;

  @ApiPropertyOptional({ enum: OperationalIncidentSeverity })
  @IsOptional()
  @IsEnum(OperationalIncidentSeverity)
  severity?: OperationalIncidentSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  impactedArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  customerImpact?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  baseSlaHours?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  evidenceItems?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  relatedJobId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  relatedRefundRequestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  relatedTrustSafetyInterventionId?: string;
}
