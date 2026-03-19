import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

type AccessTokenPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'change-me-access',
    });
  }

  async validate(payload: AccessTokenPayload): Promise<{
    sub: string;
    email: string;
    user: Pick<
      User,
      'id' | 'email' | 'name' | 'isActive' | 'role' | 'adminSubrole'
    >;
  }> {
    const user = await this.authService.validateUserById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    return {
      sub: user.id,
      email: user.email,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        role: user.role,
        adminSubrole: user.adminSubrole,
      },
    };
  }
}
