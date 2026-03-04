import { ApiProperty } from '@nestjs/swagger';

export class SessionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  deviceId!: string;

  @ApiProperty({ nullable: true })
  ip!: string | null;

  @ApiProperty({ nullable: true })
  userAgent!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  lastUsedAt!: Date;

  @ApiProperty({ nullable: true })
  revokedAt!: Date | null;
}
