import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

function toBoolean(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return value;
}

export class ListTrackingWorkerRankingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Include unavailable workers in ranking output',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toBoolean(value))
  @IsBoolean()
  includeUnavailable?: boolean;
}
