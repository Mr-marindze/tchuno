import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class ListSessionsQueryDto {
  @ApiPropertyOptional({
    enum: ['active', 'revoked', 'all'],
    default: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'revoked', 'all'])
  status?: 'active' | 'revoked' | 'all';

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    default: 'lastUsedAt:desc',
    description: 'Allowed: lastUsedAt:asc|desc, createdAt:asc|desc',
  })
  @IsOptional()
  @Matches(/^(lastUsedAt|createdAt):(asc|desc)$/)
  sort?: string;
}
