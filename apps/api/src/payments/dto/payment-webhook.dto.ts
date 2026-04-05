import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PaymentWebhookDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  externalEventId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  providerReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  transactionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
