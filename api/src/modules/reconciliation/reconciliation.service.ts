import { createHash } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Kysely } from 'kysely';
import { type AuthenticatedAdmin } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { toJson } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { PeriodicTaskRegistry } from '../../jobs/periodic-task.registry';
import { generatePublicReference } from '../../shared/references/public-reference';
import { Clock, kigaliBusinessDate } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';
import { MetricsService } from '../health/metrics.service';
import type { OperationResult, PayoutResult } from '../provider/domain/payment-provider';
import { ProviderGateway } from '../provider/provider.gateway';

type MatchState =
  | 'MATCHED'
  | 'MISSING_AT_PROVIDER'
  | 'MISSING_INTERNAL'
  | 'AMOUNT_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'REVERSAL';

interface ItemDraft {
  paymentId: string | null;
  operationType: string | null;
  internalReference: string | null;
  providerReference: string | null;
  matchState: MatchState;
  internalAmount: bigint | null;
  providerAmount: bigint | null;
  currency: string | null;
  internalStatus: string | null;
  providerStatus: string | null;
}

/** One row of the PROVISIONAL settlement CSV layout (no partner format exists yet, OQ-14). */
export interface SettlementRow {
  clientReference: string;
  providerReference: string;
  amountMinor: bigint;
  currency: string;
  status: 'SUCCEEDED' | 'FAILED' | 'REVERSED';
}

export const SETTLEMENT_CSV_HEADER =
  'client_reference,provider_reference,amount_minor,currency,status';
const MAX_SETTLEMENT_ROWS = 50_000;
const RECONCILED_TYPES = ['PAYOUT', 'CAPTURE'] as const;

/** Kigali is UTC+2 with no DST, so a business date is a fixed UTC window. */
export function kigaliDayWindow(businessDate: string): { from: Date; to: Date } {
  const from = new Date(`${businessDate}T00:00:00+02:00`);
  if (Number.isNaN(from.getTime())) {
    throw new AppError('VALIDATION_FAILED', 'Invalid business date.');
  }
  return { from, to: new Date(from.getTime() + 86_400_000) };
}

/** Strict parser for the provisional settlement CSV. Rejects the whole file on any bad row. */
export function parseSettlementCsv(content: string): SettlementRow[] {
  const lines = content
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  if (lines[0]?.trim().toLowerCase() !== SETTLEMENT_CSV_HEADER) {
    throw new AppError('VALIDATION_FAILED', `Expected header: ${SETTLEMENT_CSV_HEADER}`);
  }
  if (lines.length - 1 > MAX_SETTLEMENT_ROWS) {
    throw new AppError('VALIDATION_FAILED', 'Settlement file too large.');
  }
  return lines.slice(1).map((line, index) => {
    const cells = line.split(',').map((cell) => cell.trim());
    const [clientReference, providerReference, amount, currency, status] = cells;
    if (
      cells.length !== 5 ||
      !clientReference ||
      !providerReference ||
      !/^\d{1,18}$/.test(amount ?? '') ||
      !/^[A-Z]{3}$/.test(currency ?? '') ||
      !['SUCCEEDED', 'FAILED', 'REVERSED'].includes(status ?? '')
    ) {
      throw new AppError('VALIDATION_FAILED', `Invalid settlement row ${index + 2}.`);
    }
    return {
      clientReference,
      providerReference,
      amountMinor: BigInt(amount!),
      currency: currency!,
      status: status as SettlementRow['status'],
    };
  });
}

/**
 * Daily reconciliation (FR-REC). Compares our provider operations for a Kigali business date with
 * the partner's view — the status API, or a settlement file — and records every difference as an
 * item for operations. It never changes a payment: corrections go through the review actions
 * with an audit trail (docs/refunds-and-reconciliation.md).
 */
@Injectable()
export class ReconciliationService implements OnModuleInit {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly gateway: ProviderGateway,
    private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly periodic: PeriodicTaskRegistry,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    // Hourly check; runs yesterday's status reconciliation once per business date.
    this.periodic.register({
      name: 'daily-reconciliation',
      intervalMs: 3_600_000,
      lockKey: 7_302,
      run: async () => {
        const yesterday = kigaliBusinessDate(new Date(this.clock.now().getTime() - 86_400_000));
        const done = await this.db
          .selectFrom('reconciliation_runs')
          .select('id')
          .where('business_date', '=', yesterday)
          .where('source', '=', 'STATUS_API')
          .where('status', '=', 'COMPLETED')
          .executeTakeFirst();
        if (!done && this.gateway.isUsable('PAYOUT_STATUS')) {
          await this.runStatusReconciliation(yesterday, 'SYSTEM');
        }
      },
    });
  }

  async runStatusReconciliation(businessDate: string, triggeredBy: string) {
    const run = await this.startRun(businessDate, 'STATUS_API', triggeredBy);
    try {
      const operations = await this.operationsFor(businessDate);
      const items: ItemDraft[] = [];
      for (const operation of operations) {
        const result =
          operation.type === 'PAYOUT'
            ? await this.gateway.call('PAYOUT_STATUS', 'reconcile_payout', (provider) =>
                provider.getPayoutStatus(operation.request_ref),
              )
            : await this.gateway.call('CARD_CAPTURE', 'reconcile_capture', (provider) =>
                provider.getCapture(operation.request_ref),
              );
        items.push(this.compareStatus(operation, result));
      }
      const summary = await this.finishRun(run.id, items);
      await this.recordReversals(items);
      return summary;
    } catch (error) {
      await this.failRun(run.id, error);
      throw error instanceof AppError ? error : new AppError('PROVIDER_UNAVAILABLE');
    }
  }

  async importSettlementFile(
    admin: AuthenticatedAdmin,
    businessDate: string,
    fileName: string,
    content: string,
  ) {
    const rows = parseSettlementCsv(content);
    const sha256 = createHash('sha256').update(content).digest('hex');
    const duplicate = await this.db
      .selectFrom('reconciliation_runs')
      .select('id')
      .where('file_sha256', '=', sha256)
      .where('status', '=', 'COMPLETED')
      .executeTakeFirst();
    if (duplicate) {
      throw new AppError('CONFLICT', 'This settlement file was already imported.', {
        runId: duplicate.id,
      });
    }
    const run = await this.startRun(
      businessDate,
      'SETTLEMENT_FILE',
      admin.adminId,
      fileName,
      sha256,
    );
    try {
      const operations = await this.operationsFor(businessDate);
      const byRef = new Map(rows.map((row) => [row.clientReference, row]));
      const items: ItemDraft[] = [];
      for (const operation of operations) {
        const row = byRef.get(operation.request_ref);
        byRef.delete(operation.request_ref);
        items.push(
          row
            ? this.compareRow(operation, row)
            : this.item(operation, 'MISSING_AT_PROVIDER', null, null),
        );
      }
      for (const row of byRef.values()) {
        // Possibly an operation from another day; matched by reference only, never by guesswork.
        const known = await this.db
          .selectFrom('provider_operations')
          .selectAll()
          .where('request_ref', '=', row.clientReference)
          .executeTakeFirst();
        items.push(
          known
            ? this.compareRow(known, row)
            : {
                paymentId: null,
                operationType: null,
                internalReference: row.clientReference,
                providerReference: row.providerReference,
                matchState: 'MISSING_INTERNAL',
                internalAmount: null,
                providerAmount: row.amountMinor,
                currency: row.currency,
                internalStatus: null,
                providerStatus: row.status,
              },
        );
      }
      const result = await this.finishRun(run.id, items);
      await this.audit.record({
        action: 'reconciliation.settlement_imported',
        entityType: 'reconciliation_run',
        entityId: run.id,
        metadata: { businessDate, fileName, sha256, rows: rows.length },
      });
      return result;
    } catch (error) {
      await this.failRun(run.id, error);
      throw error;
    }
  }

  async runs(limit = 30) {
    const rows = await this.db
      .selectFrom('reconciliation_runs')
      .selectAll()
      .orderBy('started_at', 'desc')
      .limit(limit)
      .execute();
    return {
      runs: rows.map((row) => ({
        id: row.id,
        businessDate: row.business_date,
        provider: row.provider,
        source: row.source,
        fileName: row.file_name,
        status: row.status,
        totals: row.totals,
        error: row.error,
        startedAt: row.started_at.toISOString(),
        completedAt: row.completed_at?.toISOString() ?? null,
      })),
    };
  }

  async items(runId: string, onlyUnresolved: boolean) {
    let query = this.db
      .selectFrom('reconciliation_items')
      .selectAll()
      .where('run_id', '=', runId)
      .orderBy('created_at');
    if (onlyUnresolved) {
      query = query.where('resolution_status', '=', 'UNRESOLVED');
    }
    return { items: (await query.execute()).map((row) => this.itemView(row)) };
  }

  async resolve(
    admin: AuthenticatedAdmin,
    itemId: string,
    status: 'RESOLVED' | 'NOT_APPLICABLE',
    note: string,
  ) {
    const row = await this.db
      .updateTable('reconciliation_items')
      .set({
        resolution_status: status,
        resolved_by: admin.adminId,
        resolved_at: this.clock.now(),
        resolution_note: note,
      })
      .where('id', '=', itemId)
      .where('resolution_status', '=', 'UNRESOLVED')
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw new AppError('CONFLICT', 'Only an unresolved item can be resolved.');
    }
    await this.refreshOpenItemsGauge();
    await this.audit.record({
      action: 'reconciliation.item_resolved',
      entityType: 'reconciliation_item',
      entityId: itemId,
      after: { status, note },
    });
    return this.itemView(row);
  }

  /** CSV export of a run's items for finance (no personal data). */
  async exportCsv(runId: string): Promise<string> {
    const { items } = await this.items(runId, false);
    const header =
      'match_state,operation_type,internal_reference,provider_reference,internal_amount,provider_amount,currency,internal_status,provider_status,resolution_status';
    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value as string | number);
      // Neutralise spreadsheet formulas as well as quoting.
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
    };
    return (
      [
        header,
        ...items.map((item) =>
          [
            item.matchState,
            item.operationType,
            item.internalReference,
            item.providerReference,
            item.internalAmount,
            item.providerAmount,
            item.currency,
            item.internalStatus,
            item.providerStatus,
            item.resolutionStatus,
          ]
            .map(escape)
            .join(','),
        ),
      ].join('\n') + '\n'
    );
  }

  private operationsFor(businessDate: string) {
    const { from, to } = kigaliDayWindow(businessDate);
    return this.db
      .selectFrom('provider_operations')
      .selectAll()
      .where('type', 'in', [...RECONCILED_TYPES])
      .where('requested_at', '>=', from)
      .where('requested_at', '<', to)
      .orderBy('requested_at')
      .execute();
  }

  private compareStatus(operation: Operation, result: PayoutResult | OperationResult): ItemDraft {
    if (result.status === 'NOT_FOUND') {
      return this.item(operation, 'MISSING_AT_PROVIDER', null, 'NOT_FOUND');
    }
    if (result.status === 'REVERSED') {
      return this.item(operation, 'REVERSAL', null, 'REVERSED', result.providerRef);
    }
    const providerStatus = result.status === 'UNKNOWN' ? 'PENDING' : result.status;
    return this.item(
      operation,
      providerStatus === operation.status ? 'MATCHED' : 'STATUS_MISMATCH',
      null,
      result.status,
      result.providerRef,
    );
  }

  private compareRow(operation: Operation, row: SettlementRow): ItemDraft {
    let state: MatchState = 'MATCHED';
    if (row.status === 'REVERSED') {
      state = 'REVERSAL';
    } else if (row.currency !== operation.currency.trim()) {
      state = 'CURRENCY_MISMATCH';
    } else if (row.amountMinor !== operation.amount_minor) {
      state = 'AMOUNT_MISMATCH';
    } else if (row.status !== operation.status) {
      state = 'STATUS_MISMATCH';
    }
    return this.item(operation, state, row.amountMinor, row.status, row.providerReference);
  }

  private item(
    operation: Operation,
    matchState: MatchState,
    providerAmount: bigint | null,
    providerStatus: string | null,
    providerReference: string | null = operation.provider_ref,
  ): ItemDraft {
    return {
      paymentId: operation.payment_id,
      operationType: operation.type,
      internalReference: operation.request_ref,
      providerReference,
      matchState,
      internalAmount: operation.amount_minor,
      providerAmount,
      currency: operation.currency.trim(),
      internalStatus: operation.status,
      providerStatus,
    };
  }

  private async startRun(
    businessDate: string,
    source: 'STATUS_API' | 'SETTLEMENT_FILE',
    triggeredBy: string,
    fileName: string | null = null,
    sha256: string | null = null,
  ) {
    kigaliDayWindow(businessDate);
    if (businessDate >= kigaliBusinessDate(this.clock.now())) {
      throw new AppError('VALIDATION_FAILED', 'Only past business dates can be reconciled.');
    }
    return this.db
      .insertInto('reconciliation_runs')
      .values({
        business_date: businessDate,
        provider: this.gateway.name,
        source,
        status: 'RUNNING',
        triggered_by: triggeredBy,
        file_name: fileName,
        file_sha256: sha256,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  private async finishRun(runId: string, items: ItemDraft[]) {
    const totals: Record<string, number> = { total: items.length };
    for (const item of items) {
      totals[item.matchState] = (totals[item.matchState] ?? 0) + 1;
    }
    await this.db.transaction().execute(async (trx) => {
      if (items.length > 0) {
        await trx
          .insertInto('reconciliation_items')
          .values(
            items.map((item) => ({
              run_id: runId,
              payment_id: item.paymentId,
              operation_type: item.operationType,
              internal_reference: item.internalReference,
              provider_reference: item.providerReference,
              match_state: item.matchState,
              internal_amount: item.internalAmount,
              provider_amount: item.providerAmount,
              currency: item.currency,
              internal_status: item.internalStatus,
              provider_status: item.providerStatus,
              resolution_status: item.matchState === 'MATCHED' ? 'NOT_APPLICABLE' : 'UNRESOLVED',
            })),
          )
          .execute();
      }
      await trx
        .updateTable('reconciliation_runs')
        .set({ status: 'COMPLETED', totals: toJson(totals), completed_at: this.clock.now() })
        .where('id', '=', runId)
        .execute();
    });
    await this.refreshOpenItemsGauge();
    const mismatches = items.length - (totals.MATCHED ?? 0);
    if (mismatches > 0) {
      this.logger.warn(
        { runId, mismatches, alert: 'RECONCILIATION_MISMATCH' },
        'Reconciliation found differences',
      );
    }
    return { runId, totals };
  }

  /**
   * A payout reversed after it succeeded is a fact to record (and alert on), not a payment state
   * change: the seller lost the money, so operations decide how to make it right.
   */
  private async recordReversals(items: ItemDraft[]) {
    for (const item of items) {
      if (item.matchState !== 'REVERSAL' || item.operationType !== 'PAYOUT' || !item.paymentId) {
        continue;
      }
      const paymentId = item.paymentId;
      const known = await this.db
        .selectFrom('payment_adjustments')
        .select('id')
        .where('payment_id', '=', paymentId)
        .where('type', '=', 'PAYOUT_REVERSAL')
        .executeTakeFirst();
      if (known) {
        continue;
      }
      await this.db
        .insertInto('payment_adjustments')
        .values({
          reference: generatePublicReference('RF'),
          payment_id: paymentId,
          type: 'PAYOUT_REVERSAL',
          status: 'RECORDED',
          amount_minor: item.internalAmount ?? 0n,
          currency: 'RWF',
          reason: 'Reconciliation found the payout reversed by the provider',
          requested_by_type: 'PROVIDER',
          provider_ref: item.providerReference,
        })
        .execute();
      this.logger.error(
        { paymentId, alert: 'PAYOUT_REVERSED' },
        'Payout reversed after completion',
      );
    }
  }

  /** Feeds the RECONCILIATION_OPEN_ITEMS alert (api/docs/alerts.md). */
  private async refreshOpenItemsGauge() {
    const { count } = await this.db
      .selectFrom('reconciliation_items')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('resolution_status', '=', 'UNRESOLVED')
      .executeTakeFirstOrThrow();
    this.metrics.reconciliationOpenItems.set(Number(count));
  }

  private async failRun(runId: string, error: unknown) {
    const message = error instanceof Error ? error.name : 'Error';
    await this.db
      .updateTable('reconciliation_runs')
      .set({ status: 'FAILED', error: message, completed_at: this.clock.now() })
      .where('id', '=', runId)
      .execute();
    this.logger.error(
      { runId, err: error, alert: 'RECONCILIATION_FAILED' },
      'Reconciliation run failed',
    );
  }

  private itemView(row: {
    id: string;
    payment_id: string | null;
    operation_type: string | null;
    internal_reference: string | null;
    provider_reference: string | null;
    match_state: string;
    internal_amount: bigint | null;
    provider_amount: bigint | null;
    currency: string | null;
    internal_status: string | null;
    provider_status: string | null;
    resolution_status: string;
    resolution_note: string | null;
  }) {
    return {
      id: row.id,
      paymentId: row.payment_id,
      operationType: row.operation_type,
      internalReference: row.internal_reference,
      providerReference: row.provider_reference,
      matchState: row.match_state,
      internalAmount: row.internal_amount === null ? null : Number(row.internal_amount),
      providerAmount: row.provider_amount === null ? null : Number(row.provider_amount),
      currency: row.currency?.trim() ?? null,
      internalStatus: row.internal_status,
      providerStatus: row.provider_status,
      resolutionStatus: row.resolution_status,
      resolutionNote: row.resolution_note,
    };
  }
}

type Operation = Awaited<ReturnType<ReconciliationService['operationsFor']>>[number];
