import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES,
  MESSAGE_ATTACHMENT_MAX_BYTES,
  MESSAGE_ATTACHMENT_MAX_EXPIRES_SECONDS,
  MESSAGE_ATTACHMENT_MIN_EXPIRES_SECONDS,
} from '../upload-policy';

export class PresignUploadDto {
  @IsString()
  @MaxLength(256)
  fileName!: string;

  @IsIn(MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(MESSAGE_ATTACHMENT_MAX_BYTES)
  sizeBytes!: number;

  @IsOptional()
  @IsInt()
  @Min(MESSAGE_ATTACHMENT_MIN_EXPIRES_SECONDS)
  @Max(MESSAGE_ATTACHMENT_MAX_EXPIRES_SECONDS)
  expiresIn?: number;
}
