import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Kysely } from 'kysely';
import { RequestContext } from '../../common/context/request-context';
import {
  ADMIN_PERMISSION,
  ALLOW_PENDING_PROFILE,
  AuthenticatedAdmin,
  AuthenticatedUser,
} from '../../common/decorators/auth.decorators';
import { IS_PUBLIC } from '../../common/decorators/public.decorator';
import { AppError } from '../../common/errors/app-error';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { AdminPermission, roleHasPermission } from '../admin/permissions';
import { TokenService } from './token.service';

type GuardedRequest = Request & { user?: AuthenticatedUser; admin?: AuthenticatedAdmin };

/**
 * Global guard, secure by default: every route needs a valid tourist token unless marked
 * @Public, and admin routes (@RequiresAdminPermission) need an admin token with that permission.
 * The session row is checked on every request, so logout, blocking and deletion apply
 * immediately rather than when the 15-minute token expires.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly clock: Clock,
    @InjectDatabase() private readonly db: Kysely<DB>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const token = this.bearer(request);
    const permission = this.reflector.getAllAndOverride<AdminPermission | undefined>(
      ADMIN_PERMISSION,
      targets,
    );
    if (permission) {
      request.admin = await this.authenticateAdmin(token, permission);
      RequestContext.setActor({ type: 'ADMIN', id: request.admin.adminId });
      return true;
    }
    const allowPending =
      this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PROFILE, targets) ?? false;
    request.user = await this.authenticateUser(token, allowPending);
    RequestContext.setActor({ type: 'USER', id: request.user.userId });
    return true;
  }

  private bearer(request: Request): string {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('UNAUTHENTICATED');
    }
    return header.slice('Bearer '.length).trim();
  }

  private async authenticateUser(token: string, allowPending: boolean): Promise<AuthenticatedUser> {
    const claims = await this.tokens.verifyUserToken(token);
    const row = await this.db
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .select([
        'sessions.id as session_id',
        'sessions.user_id',
        'sessions.device_id_hash',
        'sessions.revoked_at',
        'sessions.expires_at',
        'users.status',
      ])
      .where('sessions.id', '=', claims.sessionId)
      .executeTakeFirst();
    if (
      !row ||
      row.user_id !== claims.userId ||
      row.revoked_at !== null ||
      row.expires_at <= this.clock.now()
    ) {
      throw new AppError('SESSION_REVOKED');
    }
    if (row.status === 'BLOCKED') {
      throw new AppError('ACCOUNT_BLOCKED');
    }
    if (row.status === 'DELETED') {
      throw new AppError('SESSION_REVOKED');
    }
    if (row.status === 'PENDING_PROFILE' && !allowPending) {
      throw new AppError('PROFILE_INCOMPLETE');
    }
    return {
      userId: row.user_id,
      sessionId: row.session_id,
      deviceIdHash: row.device_id_hash,
      status: row.status,
    };
  }

  private async authenticateAdmin(
    token: string,
    permission: AdminPermission,
  ): Promise<AuthenticatedAdmin> {
    const claims = await this.tokens.verifyAdminToken(token);
    const row = await this.db
      .selectFrom('admin_sessions')
      .innerJoin('admin_users', 'admin_users.id', 'admin_sessions.admin_id')
      .select([
        'admin_sessions.id as session_id',
        'admin_sessions.admin_id',
        'admin_sessions.revoked_at',
        'admin_sessions.expires_at',
        'admin_users.role',
        'admin_users.status',
      ])
      .where('admin_sessions.id', '=', claims.sessionId)
      .executeTakeFirst();
    if (
      !row ||
      row.admin_id !== claims.adminId ||
      row.revoked_at !== null ||
      row.expires_at <= this.clock.now() ||
      row.status !== 'ACTIVE'
    ) {
      throw new AppError('SESSION_REVOKED');
    }
    // The role is read from the database on every request: role changes apply immediately.
    if (!roleHasPermission(row.role, permission)) {
      throw new AppError('FORBIDDEN');
    }
    return { adminId: row.admin_id, sessionId: row.session_id, role: row.role };
  }
}
