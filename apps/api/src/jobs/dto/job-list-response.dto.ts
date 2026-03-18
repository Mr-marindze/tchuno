import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';
import { JobDto } from './job.dto';

export class JobListResponseDto {
  @ApiProperty({ type: JobDto, isArray: true })
  data!: JobDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
