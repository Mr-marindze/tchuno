import {
  IsEnum,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentProvider } from '@prisma/client';

export class CreatePayoutDto {
  @IsString()
  @MinLength(3)
  providerUserId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @IsOptional()
  @IsString()
  @MinLength(3)
  paymentIntentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  jobId?: string;
}
