import { IsString, MaxLength, MinLength } from 'class-validator';

export class AppealTrustSafetyInterventionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  reason!: string;
}
