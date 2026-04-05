import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRefundRequestDto {
  @IsString()
  @MinLength(3)
  paymentIntentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(240)
  reason!: string;
}
