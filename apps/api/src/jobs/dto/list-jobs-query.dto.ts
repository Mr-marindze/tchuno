import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListJobsQueryDto {
  @ApiPropertyOptional({
    enum: ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'],
  })
  @IsOptional()
  @IsIn(['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'])
  status?: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

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
}
