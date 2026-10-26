import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { AppError } from '../../common/errors/app-error';
import { Executor } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';

export type BlockableEntity = 'CARD_FINGERPRINT' | 'PAYEE' | 'DEVICE';

/** FR-ADM-04 block/unblock for card fingerprints, payees and devices (users: status on users). */
@Injectable()
export class BlocklistService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  async isBlocked(
    type: BlockableEntity,
    value: string | null | undefined,
    executor: Executor = this.db,
  ): Promise<boolean> {
    if (!value) {
      return false;
    }
    const row = await executor
      .selectFrom('blocklist_entries')
      .select('id')
      .where('entity_type', '=', type)
      .where('entity_value', '=', value)
      .where('removed_at', 'is', null)
      .executeTakeFirst();
    return row !== undefined;
  }

  async block(type: BlockableEntity, value: string, reason: string, actorId: string) {
    return this.db.transaction().execute(async (trx) => {
      const row = await trx
        .insertInto('blocklist_entries')
        .values({ entity_type: type, entity_value: value, reason, created_by: actorId })
        .onConflict((oc) =>
          oc.columns(['entity_type', 'entity_value']).where('removed_at', 'is', null).doNothing(),
        )
        .returningAll()
        .executeTakeFirst();
      if (!row) {
        throw new AppError('CONFLICT', 'Already blocked.');
      }
      if (type === 'CARD_FINGERPRINT') {
        await trx
          .updateTable('cards')
          .set({ status: 'BLOCKED', is_default: false })
          .where('fingerprint', '=', value)
          .where('status', '=', 'ACTIVE')
          .execute();
      }
      await this.audit.record(
        {
          action: 'blocklist.added',
          entityType: type.toLowerCase(),
          entityId: value,
          after: { reason },
        },
        trx,
      );
      return row;
    });
  }

  async unblock(
    type: BlockableEntity,
    value: string,
    reason: string,
    actorId: string,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const row = await trx
        .updateTable('blocklist_entries')
        .set({ removed_at: this.clock.now(), removed_by: actorId, removal_reason: reason })
        .where('entity_type', '=', type)
        .where('entity_value', '=', value)
        .where('removed_at', 'is', null)
        .returning('id')
        .executeTakeFirst();
      if (!row) {
        throw new AppError('NOT_FOUND');
      }
      await this.audit.record(
        {
          action: 'blocklist.removed',
          entityType: type.toLowerCase(),
          entityId: value,
          after: { reason },
        },
        trx,
      );
    });
  }

  async listActive() {
    return this.db
      .selectFrom('blocklist_entries')
      .selectAll()
      .where('removed_at', 'is', null)
      .orderBy('created_at', 'desc')
      .limit(500)
      .execute();
  }
}
