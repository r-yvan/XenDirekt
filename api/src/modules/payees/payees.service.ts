import { Injectable, Logger } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { maskLocalMsisdn } from '../../common/logging/masking';
import { AppConfig } from '../../config/app-config';
import { InjectDatabase } from '../../database/database.module';
import type { DB, PayeesTable } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { ConfigurationService } from '../configuration/configuration.service';
import { MetricsService } from '../health/metrics.service';
import { ProviderGateway } from '../provider/provider.gateway';
import { BlocklistService } from '../risk/blocklist.service';
import { localMsisdnFromE164, resolvePayeeIdentifier } from './domain/payee-identifier';

export interface PayeeView {
  payeeId: string;
  network: 'MTN';
  identifierType: 'PHONE' | 'MERCHANT_CODE';
  displayIdentifier: string;
  maskedIdentifier: string;
  registeredName: string;
  verifiedAt: string;
  simulated: boolean;
}

/** Hard cap on the end-to-end lookup (NFR-PER-01 target p95 ≤ 3 s). */
const LOOKUP_TIMEOUT_MS = 5_000;

/**
 * Payee lookup (FR-PAY-03/04). The registered name always comes from the partner; nothing typed
 * by the payer is ever shown as the payee's name. Failures block payment with the PRD message.
 */
@Injectable()
export class PayeesService {
  private readonly logger = new Logger(PayeesService.name);

  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly config: AppConfig,
    private readonly clock: Clock,
    private readonly configuration: ConfigurationService,
    private readonly provider: ProviderGateway,
    private readonly blocklist: BlocklistService,
    private readonly metrics: MetricsService,
  ) {}

  async lookup(identifierType: 'PHONE' | 'MERCHANT_CODE', raw: string): Promise<PayeeView> {
    if (identifierType === 'MERCHANT_CODE' && !this.config.features.merchantCodes) {
      throw new AppError('FEATURE_DISABLED', 'MoMo Pay merchant codes are not available yet.');
    }
    const routing = (await this.configuration.get('PAYEE_ROUTING')).value;
    const resolved = resolvePayeeIdentifier(identifierType, raw, routing);
    if (resolved === 'INVALID') {
      throw new AppError('INVALID_PAYEE_IDENTIFIER');
    }
    if (resolved === 'NETWORK_NOT_SUPPORTED') {
      throw new AppError('NETWORK_NOT_SUPPORTED');
    }

    const existing = await this.db
      .selectFrom('payees')
      .selectAll()
      .where('network', '=', resolved.network)
      .where('identifier_type', '=', resolved.identifierType)
      .where('identifier', '=', resolved.identifier)
      .executeTakeFirst();
    if (existing && (await this.blocklist.isBlocked('PAYEE', existing.id))) {
      throw new AppError('PAYEE_BLOCKED');
    }

    const end = this.metrics.payeeLookupDuration.startTimer();
    let result;
    try {
      result = await this.provider.callForClient(
        'PAYEE_NAME_LOOKUP_MTN',
        'payee_lookup',
        (provider) =>
          withTimeout(
            provider.lookupPayee({
              network: 'MTN',
              identifierType: resolved.identifierType,
              identifier: resolved.identifier,
            }),
            LOOKUP_TIMEOUT_MS,
          ),
      );
    } catch (error) {
      end({ outcome: 'error' });
      this.logger.warn({ identifierType, err: error }, 'Payee lookup failed');
      throw error;
    }
    end({ outcome: result.status.toLowerCase() });

    const now = this.clock.now();
    const values = {
      network: resolved.network,
      identifier_type: resolved.identifierType,
      identifier: resolved.identifier,
      registered_name:
        result.status === 'FOUND'
          ? result.registeredName.slice(0, 120)
          : (existing?.registered_name ?? null),
      lookup_status: result.status === 'FOUND' ? ('VERIFIED' as const) : result.status,
      last_verified_at: result.status === 'FOUND' ? now : (existing?.last_verified_at ?? null),
      is_simulated: this.provider.simulated,
    };
    const payee = await this.db
      .insertInto('payees')
      .values(values)
      .onConflict((oc) =>
        oc.columns(['network', 'identifier_type', 'identifier']).doUpdateSet(values),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    if (result.status === 'NOT_FOUND') {
      throw new AppError('PAYEE_NOT_FOUND');
    }
    if (result.status === 'INACTIVE') {
      throw new AppError('PAYEE_INACTIVE');
    }
    if (await this.blocklist.isBlocked('PAYEE', payee.id)) {
      throw new AppError('PAYEE_BLOCKED');
    }
    return this.view(payee, resolved.display);
  }

  /**
   * For quoting: the payee must have a fresh verified name. A stale name is looked up again
   * (the account may have closed or changed hands since).
   */
  async requireVerified(payeeId: string): Promise<Selectable<PayeesTable>> {
    const payee = await this.db
      .selectFrom('payees')
      .selectAll()
      .where('id', '=', payeeId)
      .executeTakeFirst();
    if (!payee) {
      throw new AppError('NOT_FOUND');
    }
    if (await this.blocklist.isBlocked('PAYEE', payee.id)) {
      throw new AppError('PAYEE_BLOCKED');
    }
    const routing = (await this.configuration.get('PAYEE_ROUTING')).value;
    const maxAgeMs = routing.lookupMaxAgeMinutes * 60_000;
    const fresh =
      payee.lookup_status === 'VERIFIED' &&
      payee.last_verified_at !== null &&
      this.clock.nowMs() - payee.last_verified_at.getTime() <= maxAgeMs;
    if (fresh) {
      return payee;
    }
    const raw =
      payee.identifier_type === 'PHONE'
        ? (localMsisdnFromE164(payee.identifier) ?? payee.identifier)
        : payee.identifier;
    await this.lookup(payee.identifier_type, raw);
    return this.db
      .selectFrom('payees')
      .selectAll()
      .where('id', '=', payeeId)
      .executeTakeFirstOrThrow();
  }

  async recent(user: AuthenticatedUser, limit = 5) {
    const rows = await this.db
      .selectFrom('user_payees')
      .innerJoin('payees', 'payees.id', 'user_payees.payee_id')
      .select([
        'payees.id',
        'payees.identifier_type',
        'payees.identifier',
        'payees.registered_name',
        'payees.is_simulated',
        'user_payees.last_used_at',
        'user_payees.last_amount_rwf',
      ])
      .where('user_payees.user_id', '=', user.userId)
      .where('payees.lookup_status', '=', 'VERIFIED')
      .orderBy('user_payees.last_used_at', 'desc')
      .limit(limit)
      .execute();
    return {
      payees: rows.map((row) => ({
        payeeId: row.id,
        identifierType: row.identifier_type,
        maskedIdentifier: this.mask(row.identifier_type, row.identifier),
        registeredName: row.registered_name,
        lastUsedAt: row.last_used_at.toISOString(),
        lastAmountRwf: row.last_amount_rwf === null ? null : Number(row.last_amount_rwf),
        simulated: row.is_simulated,
      })),
    };
  }

  mask(type: 'PHONE' | 'MERCHANT_CODE', identifier: string): string {
    if (type === 'PHONE') {
      const local = localMsisdnFromE164(identifier);
      return local ? maskLocalMsisdn(local) : '***';
    }
    return `${'*'.repeat(Math.max(0, identifier.length - 3))}${identifier.slice(-3)}`;
  }

  private view(payee: Selectable<PayeesTable>, display: string): PayeeView {
    return {
      payeeId: payee.id,
      network: payee.network,
      identifierType: payee.identifier_type,
      displayIdentifier: display,
      maskedIdentifier: this.mask(payee.identifier_type, payee.identifier),
      registeredName: payee.registered_name ?? '',
      verifiedAt: (payee.last_verified_at ?? this.clock.now()).toISOString(),
      simulated: payee.is_simulated,
    };
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AppError('PROVIDER_UNAVAILABLE')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
