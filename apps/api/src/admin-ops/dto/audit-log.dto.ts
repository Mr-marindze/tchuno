import { ApiProperty } from '@nestjs/swagger';
import { AuditStatus } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';

export class AuditLogDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  actorUserId!: string | null;

  @ApiProperty({ nullable: true })
  actorRole!: string | null;

  @ApiProperty()
  action!: string;

  @ApiProperty({ nullable: true })
  targetType!: string | null;

  @ApiProperty({ nullable: true })
  targetId!: string | null;

  @ApiProperty({ enum: AuditStatus })
  status!: AuditStatus;

  @ApiProperty({ nullable: true })
  reason!: string | null;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ nullable: true })
  userAgent!: string | null;

  @ApiProperty()
  route!: string;

  @ApiProperty()
  method!: string;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;
}

export class AuditLogListResponseDto {
  @ApiProperty({ type: AuditLogDto, isArray: true })
  data!: AuditLogDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
