import { ApiPropertyOptional } from '@nestjs/swagger';
import { PasswordRecoveryRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListPasswordRecoveryRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PasswordRecoveryRequestStatus })
  @IsOptional()
  @IsEnum(PasswordRecoveryRequestStatus)
  status?: PasswordRecoveryRequestStatus;
}
