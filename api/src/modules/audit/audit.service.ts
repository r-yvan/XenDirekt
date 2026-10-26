import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Actor, RequestContext } from '../../common/context/request-context';
import { redact } from '../../common/logging/redaction';
import { Executor, toJson } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  /** Defaults to the actor of the current request, else SYSTEM. */
  actor?: Actor;
}

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit: number;
  before?: Date;
}

/**
 * Append-only audit trail (FR-ADM-08: who, what, when, before/after). Snapshots are redacted
 * before storage. Pass the transaction executor so the audit row commits or rolls back together
 * with the change it describes. The table rejects UPDATE, DELETE and TRUNCATE at database level.
 */
@Injectable()
export class AuditService {
  constructor(@InjectDatabase() private readonly db: Kysely<DB>) {}

  async record(entry: AuditEntry, executor: Executor = this.db): Promise<void> {
    const actor = entry.actor ?? RequestContext.actor() ?? { type: 'SYSTEM' as const };
    await executor
      .insertInto('audit_logs')
      .values({
        actor_type: actor.type,
        actor_id: actor.id ?? null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        before: entry.before === undefined ? null : toJson(redact(entry.before)),
        after: entry.after === undefined ? null : toJson(redact(entry.after)),
        metadata: entry.metadata ? toJson(redact(entry.metadata)) : null,
        correlation_id: RequestContext.correlationId() ?? null,
      })
      .execute();
  }

  async search(query: AuditQuery) {
    let builder = this.db
      .selectFrom('audit_logs')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(query.limit);
    if (query.entityType) {
      builder = builder.where('entity_type', '=', query.entityType);
    }
    if (query.entityId) {
      builder = builder.where('entity_id', '=', query.entityId);
    }
    if (query.actorId) {
      builder = builder.where('actor_id', '=', query.actorId);
    }
    if (query.action) {
      builder = builder.where('action', '=', query.action);
    }
    if (query.from) {
      builder = builder.where('created_at', '>=', query.from);
    }
    if (query.to) {
      builder = builder.where('created_at', '<', query.to);
    }
    if (query.before) {
      builder = builder.where('created_at', '<', query.before);
    }
    return builder.execute();
  }
}
