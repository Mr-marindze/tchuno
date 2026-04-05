import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SelectProposalDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(30)
  depositPercent?: number;
}
