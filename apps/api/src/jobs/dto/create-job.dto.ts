import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  workerProfileId!: string;

  @IsString()
  categoryId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  budget!: number;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
