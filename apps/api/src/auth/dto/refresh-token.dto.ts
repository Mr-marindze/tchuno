import { Transform } from 'class-transformer';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsJWT()
  refreshToken!: string;
}
