import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PasswordRecoveryRequestStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePasswordRecoveryRequestDto {
  @ApiProperty({
    enum: PasswordRecoveryRequestStatus,
    description: 'Allowed values: IN_PROGRESS, RESOLVED or CANCELED',
  })
  @IsEnum(PasswordRecoveryRequestStatus)
  status!: PasswordRecoveryRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  note?: string;
}
