import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  OperationalIncidentSeverity,
  OperationalIncidentSource,
  OperationalIncidentStatus,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
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
