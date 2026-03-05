import { ApiProperty } from '@nestjs/swagger';
import { SessionDto } from './session.dto';

export class SessionListMetaDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageCount!: number;

  @ApiProperty()
  hasNext!: boolean;

  @ApiProperty()
  hasPrev!: boolean;
}

export class SessionListResponseDto {
  @ApiProperty({ type: SessionDto, isArray: true })
  data!: SessionDto[];

  @ApiProperty({ type: SessionListMetaDto })
  meta!: SessionListMetaDto;
}
