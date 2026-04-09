import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveRefundRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  decisionNote?: string;
}
