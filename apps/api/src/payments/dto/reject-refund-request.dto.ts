import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectRefundRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  decisionNote?: string;
}
