import { SetMetadata } from '@nestjs/common';
import { REQUIRE_APP_ROLES_KEY } from '../authorization.constants';
import { AppRole } from '../authorization.types';

export const RequireAppRoles = (...roles: AppRole[]) =>
  SetMetadata(REQUIRE_APP_ROLES_KEY, roles);
