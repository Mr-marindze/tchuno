import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

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

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toBoolean(value))
  @IsBoolean()
  includeInactive?: boolean;
}
