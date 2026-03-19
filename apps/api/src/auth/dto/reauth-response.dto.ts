import { ApiProperty } from '@nestjs/swagger';

export class ReauthResponseDto {
  @ApiProperty()
  reauthToken!: string;

  @ApiProperty()
  expiresAt!: Date;
}
