import { IsJWT, IsOptional } from 'class-validator';

export class RefreshTokenDto {
  @IsOptional()
  @IsJWT()
  refreshToken?: string;
}
