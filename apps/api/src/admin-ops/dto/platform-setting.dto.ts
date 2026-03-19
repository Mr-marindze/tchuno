import { ApiProperty } from '@nestjs/swagger';

export class PlatformSettingDto {
  @ApiProperty()
  key!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  value!: Record<string, unknown>;

  @ApiProperty({ nullable: true })
  updatedByUserId!: string | null;

  @ApiProperty()
  updatedAt!: Date;
}
