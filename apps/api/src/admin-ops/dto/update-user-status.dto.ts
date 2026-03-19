import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'true to reactivate account, false to suspend account',
  })
  @IsBoolean()
  isActive!: boolean;
}
