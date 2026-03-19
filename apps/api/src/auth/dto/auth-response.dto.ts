import { ApiProperty } from '@nestjs/swagger';

class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ enum: ['USER', 'ADMIN'] })
  role!: 'USER' | 'ADMIN';

  @ApiProperty({
    enum: ['SUPPORT_ADMIN', 'OPS_ADMIN', 'SUPER_ADMIN'],
    nullable: true,
  })
  adminSubrole!: 'SUPPORT_ADMIN' | 'OPS_ADMIN' | 'SUPER_ADMIN' | null;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}
