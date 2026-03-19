import { SetMetadata } from '@nestjs/common';
import { REQUIRE_PERMISSIONS_KEY } from '../authorization.constants';
import { Permission } from '../authorization.types';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
