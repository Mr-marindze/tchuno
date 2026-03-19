import { SetMetadata } from '@nestjs/common';
import { REQUIRE_REAUTH_KEY } from '../authorization.constants';

export const RequireReauth = () => SetMetadata(REQUIRE_REAUTH_KEY, true);
