import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReviewTrustSafetyInterventionDto {
  @IsIn(['CLEARED', 'ENFORCED'])
  decision!: 'CLEARED' | 'ENFORCED';

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  resolutionNote?: string;
}
