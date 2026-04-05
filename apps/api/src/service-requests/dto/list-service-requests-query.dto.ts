import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListServiceRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'CLOSED', 'EXPIRED'] })
  @IsOptional()
  @IsIn(['OPEN', 'CLOSED', 'EXPIRED'])
  status?: 'OPEN' | 'CLOSED' | 'EXPIRED';

  @ApiPropertyOptional({ description: 'Search by title or description' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;
}
