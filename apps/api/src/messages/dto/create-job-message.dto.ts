import { Transform, Type } from 'class-transformer';
import {
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  IsIn,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES,
  MESSAGE_ATTACHMENT_MAX_BYTES,
} from '../upload-policy';

export class JobMessageAttachmentInputDto {
  @IsString()
  @MaxLength(2048)
  url!: string;

  @IsString()
  @MaxLength(512)
  key!: string;

  @IsIn(MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(MESSAGE_ATTACHMENT_MAX_BYTES)
  size!: number;
}

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
  @ValidateNested({ each: true })
  @Type(() => JobMessageAttachmentInputDto)
  attachments?: JobMessageAttachmentInputDto[];
}
