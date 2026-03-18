import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';
import { ReviewDto } from './review.dto';

export class ReviewListResponseDto {
  @ApiProperty({ type: ReviewDto, isArray: true })
  data!: ReviewDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
