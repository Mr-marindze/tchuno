import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CreatePaymentIntentDto {
  @IsString()
  @MinLength(3)
  jobId!: string;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
