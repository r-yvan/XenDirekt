import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AdminPermission } from '../../modules/admin/permissions';
import type { AdminRole } from '../../database/schema';

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  deviceIdHash: string;
  status: 'PENDING_PROFILE' | 'ACTIVE';
}

export interface AuthenticatedAdmin {
  adminId: string;
  sessionId: string;
  role: AdminRole;
}

export const ALLOW_PENDING_PROFILE = 'xd:allowPendingProfile';
export const ADMIN_PERMISSION = 'xd:adminPermission';

/** Tourist routes usable before the profile (name, country, DOB, consent) is complete. */
export const AllowPendingProfile = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_PENDING_PROFILE, true);

/** Marks an admin route; the guard requires an admin token whose role grants `permission`. */
export const RequiresAdminPermission = (
  permission: AdminPermission,
): MethodDecorator & ClassDecorator => SetMetadata(ADMIN_PERMISSION, permission);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedAdmin =>
    context.switchToHttp().getRequest<{ admin: AuthenticatedAdmin }>().admin,
);
