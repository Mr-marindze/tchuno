import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ProcessPayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  simulate?: 'success' | 'pending' | 'failed';

  @IsOptional()
  @IsString()
  @MaxLength(128)
  providerReference?: string;
}
