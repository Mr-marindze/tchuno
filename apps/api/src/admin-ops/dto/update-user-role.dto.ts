import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminSubrole, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional({
    enum: AdminSubrole,
    nullable: true,
    description: 'Only applies when role=ADMIN',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      return null;
    }

    return value;
  })
  @IsEnum(AdminSubrole)
  adminSubrole?: AdminSubrole | null;
}
