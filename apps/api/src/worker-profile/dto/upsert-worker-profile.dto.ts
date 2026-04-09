import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertWorkerProfileDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(80)
  publicName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  hourlyRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsIn(['AVAILABLE_NOW', 'LIMITED_THIS_WEEK', 'NEXT_WEEK', 'UNAVAILABLE'])
  availabilityStatus?:
    | 'AVAILABLE_NOW'
    | 'LIMITED_THIS_WEEK'
    | 'NEXT_WEEK'
    | 'UNAVAILABLE';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? (value as unknown[]).map((item: unknown) =>
          typeof item === 'string' ? item.trim() : item,
        )
      : value,
  )
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(80, { each: true })
  serviceAreaPreferences?: string[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? (value as unknown[]).map((item: unknown) =>
          typeof item === 'string' ? item.trim() : item,
        )
      : value,
  )
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(3, { each: true })
  categoryIds?: string[];
}
