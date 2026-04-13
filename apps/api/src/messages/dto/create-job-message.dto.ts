import { Transform } from 'class-transformer';
import {
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';

export class CreateJobMessageDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  attachments?: string[];
}
