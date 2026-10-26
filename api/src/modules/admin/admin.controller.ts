import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Kysely } from 'kysely';
import {
  type AuthenticatedAdmin,
  CurrentAdmin,
  RequiresAdminPermission,
} from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AppError } from '../../common/errors/app-error';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';
import { AdminAuthService } from './admin-auth.service';
import {
  AdminLoginDto,
  AdminRefreshDto,
  AdminTotpDto,
  CreateAdminDto,
  UpdateAdminDto,
} from './dto/admin.dto';

@ApiTags('admin: identity')
@Controller('v1/admin')
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    @InjectDatabase() private readonly db: Kysely<DB>,
  ) {}

  @Public()
  @Post('auth/login')
  @HttpCode(200)
  @RateLimit(
    { name: 'admin-login-ip', key: 'ip', limit: 10, windowSeconds: 900 },
    { name: 'admin-login-email', key: 'body:email', limit: 10, windowSeconds: 900 },
  )
  login(@Body() body: AdminLoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @Post('auth/totp')
  @HttpCode(200)
  @RateLimit({ name: 'admin-totp-ip', key: 'ip', limit: 20, windowSeconds: 900 })
  totp(@Body() body: AdminTotpDto) {
    return this.auth.verifyTotp(body.challengeToken, body.totp);
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  @RateLimit({ name: 'admin-refresh-ip', key: 'ip', limit: 60, windowSeconds: 900 })
  refresh(@Body() body: AdminRefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('auth/logout')
  @HttpCode(204)
  @ApiBearerAuth('admin')
  @RequiresAdminPermission('self')
  async logout(@CurrentAdmin() admin: AuthenticatedAdmin): Promise<void> {
    await this.auth.logout(admin);
  }

  @Get('me')
  @ApiBearerAuth('admin')
  @RequiresAdminPermission('self')
  me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.db
      .selectFrom('admin_users')
      .select(['id', 'email', 'full_name as fullName', 'role', 'last_login_at as lastLoginAt'])
      .where('id', '=', admin.adminId)
      .executeTakeFirstOrThrow();
  }

  @Get('admin-users')
  @ApiBearerAuth('admin')
  @RequiresAdminPermission('admins:manage')
  list() {
    return this.db
      .selectFrom('admin_users')
      .select([
        'id',
        'email',
        'full_name as fullName',
        'role',
        'status',
        'last_login_at as lastLoginAt',
        'created_at as createdAt',
      ])
      .orderBy('created_at')
      .execute();
  }

  @Post('admin-users')
  @ApiBearerAuth('admin')
  @RequiresAdminPermission('admins:manage')
  @RateLimit({ name: 'admin-create', key: 'admin', limit: 20, windowSeconds: 3600 })
  create(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() body: CreateAdminDto) {
    return this.auth.createAdmin({
      email: body.email,
      fullName: body.fullName,
      role: body.role,
      createdBy: admin.adminId,
    });
  }

  @Patch('admin-users/:id')
  @ApiBearerAuth('admin')
  @RequiresAdminPermission('admins:manage')
  async update(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAdminDto,
  ) {
    if (id === admin.adminId) {
      throw new AppError('FORBIDDEN', 'Administrators cannot change their own role or status.');
    }
    return this.db.transaction().execute(async (trx) => {
      const before = await trx
        .selectFrom('admin_users')
        .select(['role', 'status'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!before) {
        throw new AppError('NOT_FOUND');
      }
      const after = await trx
        .updateTable('admin_users')
        .set({
          ...(body.role ? { role: body.role } : {}),
          ...(body.status ? { status: body.status } : {}),
        })
        .where('id', '=', id)
        .returning(['id', 'email', 'role', 'status'])
        .executeTakeFirstOrThrow();
      if (body.status === 'DISABLED') {
        await trx
          .updateTable('admin_sessions')
          .set({ revoked_at: this.clock.now(), revoked_reason: 'ADMIN' })
          .where('admin_id', '=', id)
          .where('revoked_at', 'is', null)
          .execute();
      }
      await this.audit.record(
        {
          action: 'admin.updated',
          entityType: 'admin_user',
          entityId: id,
          before,
          after: { role: after.role, status: after.status },
        },
        trx,
      );
      return after;
    });
  }
}
