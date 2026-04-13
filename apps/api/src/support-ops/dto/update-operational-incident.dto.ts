import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  OperationalIncidentSeverity,
  OperationalIncidentSource,
  OperationalIncidentStatus,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateOperationalIncidentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(600)
  summary?: string;

  @ApiPropertyOptional({ enum: OperationalIncidentSource })
  @IsOptional()
  @IsEnum(OperationalIncidentSource)
  source?: OperationalIncidentSource;

  @ApiPropertyOptional({ enum: OperationalIncidentSeverity })
  @IsOptional()
  @IsEnum(OperationalIncidentSeverity)
  severity?: OperationalIncidentSeverity;

  @ApiPropertyOptional({ enum: OperationalIncidentStatus })
  @IsOptional()
  @IsEnum(OperationalIncidentStatus)
  status?: OperationalIncidentStatus;

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

  @ApiPropertyOptional({ description: 'Assign the case to the acting admin' })
  @IsOptional()
  @IsBoolean()
  assignToMe?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  evidenceItems?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(600)
  resolutionNote?: string;
}
