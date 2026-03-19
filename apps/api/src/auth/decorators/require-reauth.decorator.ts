import { SetMetadata } from '@nestjs/common';
import { REQUIRE_REAUTH_KEY } from '../authorization.constants';

export type ReauthRequirement =
  | true
  | {
      required: true;
      purpose?: string;
    };

export const RequireReauth = (purpose?: string) =>
  SetMetadata(
    REQUIRE_REAUTH_KEY,
    purpose
      ? {
          required: true,
          purpose,
        }
      : true,
  );
