import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  OperationalIncidentSource,
  OperationalIncidentStatus,
} from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListOperationalIncidentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OperationalIncidentStatus })
  @IsOptional()
  @IsEnum(OperationalIncidentStatus)
  status?: OperationalIncidentStatus;

  @ApiPropertyOptional({ enum: OperationalIncidentSource })
  @IsOptional()
  @IsEnum(OperationalIncidentSource)
  source?: OperationalIncidentSource;
}
