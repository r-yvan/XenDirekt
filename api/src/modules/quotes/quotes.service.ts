import { Injectable } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { Executor } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB, QuotesTable } from '../../database/schema';
import { currencyExponent, formatMoneyForDisplay } from '../../shared/money/currency';
import { formatRate, parseRate } from '../../shared/money/fx';
import { toSafeNumber } from '../../shared/money/money';
import { Clock } from '../../shared/time/clock';
import { CardsService } from '../cards/cards.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { PayeesService } from '../payees/payees.service';
import { ProviderGateway } from '../provider/provider.gateway';
import { calculateQuote, displayRate } from './domain/quote-calculator';
import { LimitsService } from './limits.service';

export const QUOTE_TTL_MS = 5 * 60_000;

/**
 * Server-side quote (FR-QTE-01/02): every figure the tourist sees is computed and frozen here.
 * The app never calculates fees, FX or totals. Valid for 5 minutes.
 */
@Injectable()
export class QuotesService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly configuration: ConfigurationService,
    private readonly cards: CardsService,
    private readonly payees: PayeesService,
    private readonly limits: LimitsService,
    private readonly provider: ProviderGateway,
  ) {}

  async create(
    user: AuthenticatedUser,
    input: { payeeId: string; cardId: string; amountRwf: number },
  ) {
    const card = await this.cards.ownedActive(this.db, user.userId, input.cardId);
    const payee = await this.payees.requireVerified(input.payeeId);
    const [fees, limits, fx] = await Promise.all([
      this.configuration.get('FEES'),
      this.configuration.get('LIMITS'),
      this.configuration.get('FX_RATES'),
    ]);
    if (limits.value.paymentsPaused) {
      throw new AppError('PAYMENTS_PAUSED');
    }
    for (const config of [fees, limits, fx]) {
      this.configuration.assertUsable(config);
    }
    const amountRwf = BigInt(input.amountRwf);
    await this.limits.assertWithinLimits(
      this.db,
      { userId: user.userId, cardId: card.id, payeeId: payee.id },
      amountRwf,
      limits.value,
    );

    const cardCurrency =
      card.card_currency && fx.value.rates[card.card_currency]
        ? card.card_currency
        : fx.value.defaultCardCurrency;
    const figures = calculateQuote({ amountRwf, cardCurrency, fees: fees.value, fx: fx.value });
    const quote = await this.db
      .insertInto('quotes')
      .values({
        user_id: user.userId,
        payee_id: payee.id,
        card_id: card.id,
        amount_rwf: figures.amountRwf,
        fee_rwf: figures.feeRwf,
        total_rwf: figures.totalRwf,
        card_currency: figures.cardCurrency,
        fx_rate: figures.fxRate,
        fx_source: fx.value.source,
        total_card_minor: figures.totalCardMinor,
        rounding_mode: figures.roundingMode,
        fee_config_version: fees.version,
        limits_config_version: limits.version,
        fx_config_version: fx.version,
        config_approved: fees.approved && limits.approved && fx.approved,
        is_simulated: this.provider.simulated,
        expires_at: this.clock.plusMs(QUOTE_TTL_MS),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.view(quote, {
      payee: {
        payeeId: payee.id,
        registeredName: payee.registered_name ?? '',
        maskedIdentifier: this.payees.mask(payee.identifier_type, payee.identifier),
      },
      card: { id: card.id, brand: card.brand, last4: card.last4 },
    });
  }

  view(
    quote: Selectable<QuotesTable>,
    related: {
      payee: { payeeId: string; registeredName: string; maskedIdentifier: string };
      card: { id: string; brand: string; last4: string };
    },
  ) {
    return {
      quoteId: quote.id,
      expiresAt: quote.expires_at.toISOString(),
      amountRwf: toSafeNumber(quote.amount_rwf),
      feeRwf: toSafeNumber(quote.fee_rwf),
      totalRwf: toSafeNumber(quote.total_rwf),
      cardCurrency: quote.card_currency,
      cardCurrencyExponent: currencyExponent(quote.card_currency),
      totalCardMinor: toSafeNumber(quote.total_card_minor),
      totalCardDisplay: formatMoneyForDisplay(quote.total_card_minor, quote.card_currency),
      fxRate: formatRate(parseRate(quote.fx_rate)),
      fxRateDisplay: displayRate(quote.card_currency, formatRate(parseRate(quote.fx_rate))),
      payee: related.payee,
      card: related.card,
      simulated: quote.is_simulated,
      configApproved: quote.config_approved,
    };
  }

  /** Loads a quote for payment creation; throws QUOTE_EXPIRED / QUOTE_ALREADY_USED / NOT_FOUND. */
  async requireUsable(userId: string, quoteId: string, executor: Executor = this.db) {
    const quote = await executor
      .selectFrom('quotes')
      .selectAll()
      .where('id', '=', quoteId)
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
    if (!quote) {
      throw new AppError('NOT_FOUND');
    }
    if (quote.status === 'USED') {
      throw new AppError('QUOTE_ALREADY_USED');
    }
    if (quote.status === 'EXPIRED' || quote.expires_at <= this.clock.now()) {
      throw new AppError('QUOTE_EXPIRED');
    }
    return quote;
  }
}
