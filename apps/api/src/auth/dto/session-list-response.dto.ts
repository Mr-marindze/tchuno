import { ApiProperty } from '@nestjs/swagger';
import { SessionDto } from './session.dto';

export class SessionListMetaDto {
  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 3 })
  pageCount!: number;

  @ApiProperty({ example: true })
  hasNext!: boolean;

  @ApiProperty({ example: false })
  hasPrev!: boolean;
}

export class SessionListResponseDto {
  @ApiProperty({ type: SessionDto, isArray: true })
  data!: SessionDto[];

  @ApiProperty({ type: SessionListMetaDto })
  meta!: SessionListMetaDto;
}
