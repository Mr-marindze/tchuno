import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class TriggerReconciliationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  minAgeMinutes?: number;
}
