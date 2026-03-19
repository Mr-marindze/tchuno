import { ApiProperty } from '@nestjs/swagger';
import { AdminSubrole, UserRole } from '@prisma/client';

export class AdminManagedUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: AdminSubrole, nullable: true })
  adminSubrole!: AdminSubrole | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  updatedAt!: Date;
}
