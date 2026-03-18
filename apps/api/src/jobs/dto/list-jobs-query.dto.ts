import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListJobsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'],
  })
  @IsOptional()
  @IsIn(['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'])
  status?: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

  @ApiPropertyOptional({
    description: 'Search by title or description',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    default: 'createdAt:desc',
    description: 'Allowed: createdAt:asc|desc, budget:asc|desc',
  })
  @IsOptional()
  @Matches(/^(createdAt|budget):(asc|desc)$/)
  sort?: string;
}
