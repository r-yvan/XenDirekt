import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Kysely } from 'kysely';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import {
  type AuthenticatedAdmin,
  CurrentAdmin,
  RequiresAdminPermission,
} from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';
import { BlocklistService } from './blocklist.service';

const ENTITY_TYPES = ['USER', 'CARD_FINGERPRINT', 'PAYEE', 'DEVICE'] as const;

class BlockDto {
  @ApiProperty({ enum: ENTITY_TYPES })
  @IsIn(ENTITY_TYPES)
  entityType: (typeof ENTITY_TYPES)[number];
  @ApiProperty({ description: 'User ID, card fingerprint, payee ID or device hash' })
  @IsString()
  @Length(3, 200)
  value: string;
  @ApiProperty() @IsString() @Length(5, 500) reason: string;
}
class FlagReviewDto {
  @ApiProperty({ enum: ['CONFIRMED_FRAUD', 'DISMISSED'] })
  @IsIn(['CONFIRMED_FRAUD', 'DISMISSED'])
  status: 'CONFIRMED_FRAUD' | 'DISMISSED';
  @ApiProperty() @IsString() @Length(5, 500) note: string;
}
class FlagsQuery {
  @ApiPropertyOptional() @IsOptional() @IsIn(['OPEN', 'CONFIRMED_FRAUD', 'DISMISSED']) status?:
    'OPEN' | 'CONFIRMED_FRAUD' | 'DISMISSED';
}

/** FR-ADM-04 block/unblock and NFR-RSK flag review. Blocking a user ends their sessions at once. */
@ApiTags('admin: risk')
@ApiBearerAuth('admin')
@Controller('v1/admin')
export class AdminRiskController {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly blocklist: BlocklistService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  @Get('blocks')
  @RequiresAdminPermission('risk:read')
  async blocks() {
    const entries = await this.blocklist.listActive();
    const users = await this.db
      .selectFrom('users')
      .select(['id', 'blocked_reason', 'blocked_at'])
      .where('status', '=', 'BLOCKED')
      .execute();
    return {
      blocks: [
        ...entries.map((entry) => ({
          entityType: entry.entity_type,
          value: entry.entity_value,
          reason: entry.reason,
          createdAt: entry.created_at.toISOString(),
        })),
        ...users.map((user) => ({
          entityType: 'USER',
          value: user.id,
          reason: user.blocked_reason,
          createdAt: user.blocked_at?.toISOString() ?? null,
        })),
      ],
    };
  }

  @Post('blocks')
  @RequiresAdminPermission('blocks:manage')
  async block(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() body: BlockDto) {
    if (body.entityType !== 'USER') {
      await this.blocklist.block(body.entityType, body.value, body.reason, admin.adminId);
      return { blocked: true };
    }
    await this.db.transaction().execute(async (trx) => {
      const before = await trx
        .selectFrom('users')
        .select(['status'])
        .where('id', '=', body.value)
        .forUpdate()
        .executeTakeFirst();
      if (!before || before.status === 'DELETED') {
        throw new AppError('NOT_FOUND');
      }
      await trx
        .updateTable('users')
        .set({ status: 'BLOCKED', blocked_at: this.clock.now(), blocked_reason: body.reason })
        .where('id', '=', body.value)
        .execute();
      await trx
        .updateTable('sessions')
        .set({ revoked_at: this.clock.now(), revoked_reason: 'ACCOUNT_BLOCKED' })
        .where('user_id', '=', body.value)
        .where('revoked_at', 'is', null)
        .execute();
      await this.audit.record(
        {
          action: 'user.blocked',
          entityType: 'user',
          entityId: body.value,
          before,
          after: { status: 'BLOCKED', reason: body.reason },
        },
        trx,
      );
    });
    return { blocked: true };
  }

  @Delete('blocks')
  @HttpCode(204)
  @RequiresAdminPermission('blocks:manage')
  async unblock(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() body: BlockDto): Promise<void> {
    if (body.entityType !== 'USER') {
      await this.blocklist.unblock(body.entityType, body.value, body.reason, admin.adminId);
      return;
    }
    await this.db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom('users')
        .select(['status', 'full_name', 'country_of_residence', 'date_of_birth'])
        .where('id', '=', body.value)
        .forUpdate()
        .executeTakeFirst();
      if (!user || user.status !== 'BLOCKED') {
        throw new AppError('NOT_FOUND');
      }
      const complete = Boolean(user.full_name && user.country_of_residence && user.date_of_birth);
      await trx
        .updateTable('users')
        .set({
          status: complete ? 'ACTIVE' : 'PENDING_PROFILE',
          blocked_at: null,
          blocked_reason: null,
        })
        .where('id', '=', body.value)
        .execute();
      await this.audit.record(
        {
          action: 'user.unblocked',
          entityType: 'user',
          entityId: body.value,
          metadata: { reason: body.reason },
        },
        trx,
      );
    });
  }

  @Get('risk-flags')
  @RequiresAdminPermission('risk:read')
  async flags(@Query() query: FlagsQuery) {
    const rows = await this.db
      .selectFrom('risk_flags')
      .selectAll()
      .where('status', '=', query.status ?? 'OPEN')
      .orderBy('created_at', 'desc')
      .limit(200)
      .execute();
    return { flags: rows };
  }

  @Patch('risk-flags/:id')
  @RequiresAdminPermission('blocks:manage')
  async review(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: FlagReviewDto,
  ) {
    const row = await this.db
      .updateTable('risk_flags')
      .set({
        status: body.status,
        reviewer_id: admin.adminId,
        reviewed_at: this.clock.now(),
        review_note: body.note,
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw new AppError('NOT_FOUND');
    }
    await this.audit.record({
      action: 'risk_flag.reviewed',
      entityType: 'risk_flag',
      entityId: id,
      after: { status: body.status, note: body.note },
    });
    return row;
  }
}
