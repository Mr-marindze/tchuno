import { ApiProperty } from '@nestjs/swagger';
import { AdminSubrole, UserRole } from '@prisma/client';

export class AdminExportUsersResponseDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Total users grouped by role',
  })
  totalsByRole!: Record<UserRole, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description:
      'Admin users grouped by subrole; key null means admin without explicit subrole',
  })
  totalsByAdminSubrole!: Record<AdminSubrole | 'none', number>;

  @ApiProperty({
    description: 'Total active users in export snapshot',
  })
  activeUsers!: number;

  @ApiProperty({
    description: 'Total suspended users in export snapshot',
  })
  inactiveUsers!: number;

  @ApiProperty({
    description: 'Snapshot timestamp (ISO string)',
  })
  exportedAt!: string;
}
