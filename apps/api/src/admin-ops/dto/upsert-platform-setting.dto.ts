import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UpsertPlatformSettingDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'JSON value persisted as platform setting payload',
  })
  @IsNotEmpty()
  value!: Record<string, unknown>;
}
