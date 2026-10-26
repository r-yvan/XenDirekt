import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { AppError } from '../../common/errors/app-error';
import { AppConfig } from '../../config/app-config';
import { Executor, toJson } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { ConfigKey, DB } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';
import { CONFIG_SCHEMAS, ConfigValues, PLACEHOLDER_CONFIG } from './config-schemas';

export interface ResolvedConfig<K extends ConfigKey> {
  key: K;
  /** 0 = built-in placeholder (no database version yet). */
  version: number;
  approved: boolean;
  value: ConfigValues[K];
}

/** Keys that set prices or limits: production must not run on unapproved values. */
const MONEY_KEYS: ConfigKey[] = ['FEES', 'LIMITS', 'FX_RATES'];

/**
 * Versioned business configuration (FR-ADM-05): fees, limits, FX, card rules and payee routing
 * change without a release. Every version is validated against its schema, audited, and kept;
 * activation supersedes the previous version atomically.
 */
@Injectable()
export class ConfigurationService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly appConfig: AppConfig,
    private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  async get<K extends ConfigKey>(key: K, executor: Executor = this.db): Promise<ResolvedConfig<K>> {
    const row = await executor
      .selectFrom('configuration_versions')
      .select(['version', 'approved', 'value'])
      .where('config_key', '=', key)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst();
    if (!row) {
      return { key, version: 0, approved: false, value: PLACEHOLDER_CONFIG[key] };
    }
    return {
      key,
      version: row.version,
      approved: row.approved,
      value: CONFIG_SCHEMAS[key].parse(row.value) as ConfigValues[K],
    };
  }

  /** Throws CONFIGURATION_NOT_APPROVED in production when a money-related key is unapproved. */
  assertUsable(config: ResolvedConfig<ConfigKey>): void {
    if (this.appConfig.isProduction && MONEY_KEYS.includes(config.key) && !config.approved) {
      throw new AppError('CONFIGURATION_NOT_APPROVED', undefined, { configKey: config.key });
    }
  }

  async list(key: ConfigKey) {
    return this.db
      .selectFrom('configuration_versions')
      .selectAll()
      .where('config_key', '=', key)
      .orderBy('version', 'desc')
      .execute();
  }

  async createDraft(key: ConfigKey, value: unknown, changeReason: string, createdBy: string) {
    const parsed = CONFIG_SCHEMAS[key].safeParse(value);
    if (!parsed.success) {
      throw new AppError('VALIDATION_FAILED', undefined, {
        fields: parsed.error.issues
          .map((issue) => `${issue.path.join('.') || key}: ${issue.message}`)
          .slice(0, 20),
      });
    }
    return this.db.transaction().execute(async (trx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`config:${key}`}))`.execute(trx);
      const latest = await trx
        .selectFrom('configuration_versions')
        .select((eb) => eb.fn.max('version').as('version'))
        .where('config_key', '=', key)
        .executeTakeFirst();
      const row = await trx
        .insertInto('configuration_versions')
        .values({
          config_key: key,
          version: (latest?.version ?? 0) + 1,
          value: toJson(parsed.data),
          status: 'DRAFT',
          change_reason: changeReason,
          created_by: createdBy,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit.record(
        {
          action: 'config.draft_created',
          entityType: 'configuration',
          entityId: `${key}:v${row.version}`,
          after: parsed.data,
        },
        trx,
      );
      return row;
    });
  }

  /**
   * Activates a draft. `approvalReference` (for example a PM sign-off record) marks the values as
   * approved for production; without it the version is usable only outside production.
   */
  async activate(key: ConfigKey, version: number, activatedBy: string, approvalReference?: string) {
    return this.db.transaction().execute(async (trx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`config:${key}`}))`.execute(trx);
      const target = await trx
        .selectFrom('configuration_versions')
        .selectAll()
        .where('config_key', '=', key)
        .where('version', '=', version)
        .forUpdate()
        .executeTakeFirst();
      if (!target) {
        throw new AppError('NOT_FOUND');
      }
      if (target.status !== 'DRAFT') {
        throw new AppError('CONFLICT', 'Only a draft version can be activated.');
      }
      const previous = await trx
        .updateTable('configuration_versions')
        .set({ status: 'SUPERSEDED' })
        .where('config_key', '=', key)
        .where('status', '=', 'ACTIVE')
        .returning(['version', 'value'])
        .executeTakeFirst();
      const activated = await trx
        .updateTable('configuration_versions')
        .set({
          status: 'ACTIVE',
          activated_by: activatedBy,
          activated_at: this.clock.now(),
          approved: approvalReference !== undefined,
          approval_reference: approvalReference ?? null,
        })
        .where('id', '=', target.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit.record(
        {
          action: 'config.activated',
          entityType: 'configuration',
          entityId: `${key}:v${version}`,
          before: previous ? { version: previous.version, value: previous.value } : null,
          after: {
            version,
            value: activated.value,
            approved: activated.approved,
            approvalReference: approvalReference ?? null,
          },
        },
        trx,
      );
      return activated;
    });
  }
}
