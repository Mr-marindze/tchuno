import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReconcileTransactionDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  simulate?: 'success' | 'pending' | 'failed' | 'reversed';
}
