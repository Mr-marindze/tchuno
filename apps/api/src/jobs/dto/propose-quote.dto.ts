import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ProposeQuoteDto {
  @ApiProperty({ minimum: 1, maximum: 100_000_000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  quotedAmount!: number;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(280)
  quoteMessage?: string;
}
