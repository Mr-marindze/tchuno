import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';
import { WorkerProfileDto } from './worker-profile.dto';

export class WorkerProfileListResponseDto {
  @ApiProperty({ type: WorkerProfileDto, isArray: true })
  data!: WorkerProfileDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
