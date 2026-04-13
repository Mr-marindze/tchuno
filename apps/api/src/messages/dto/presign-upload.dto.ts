import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PresignUploadDto {
  @IsString()
  @MaxLength(256)
  fileName!: string;

  @IsString()
  @MaxLength(128)
  contentType!: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  // expires in seconds
  expiresIn?: number;
}
