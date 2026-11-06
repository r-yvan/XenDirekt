import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kysely, Selectable, sql } from 'kysely';
import { type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { AppConfig } from '../../config/app-config';
import { Executor } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { CardsTable, DB } from '../../database/schema';
import { FieldEncryption } from '../../shared/crypto/field-encryption';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { ProviderGateway } from '../provider/provider.gateway';
import { BlocklistService } from '../risk/blocklist.service';
import { AccountDeletionHooks } from '../users/account-deletion.hooks';
import { checkCardEligibility } from './domain/card-eligibility';

export const CARD_SETUP_RETURN_URL = 'xendirekt-app://card-setup/return';
/** Web portal page the hosted card page returns to for web sessions. */
export const WEB_CARD_SETUP_RETURN_PATH = '/app/cards/return';
export const TOKEN_CONTEXT = 'cards.provider_token';

export interface CardView {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  issuingCountry: string | null;
  cardCurrency: string | null;
  isDefault: boolean;
  status: string;
  simulated: boolean;
}

/**
 * Cards (FR-CRD-01..05). The app never sees a card number: the partner's hosted page collects it,
 * and the server fetches the token plus trusted metadata from the partner by setup ID. Tokens are
 * stored AES-256-GCM encrypted and deleted when a card is removed.
 */
@Injectable()
export class CardsService implements OnModuleInit {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly provider: ProviderGateway,
    private readonly configuration: ConfigurationService,
    private readonly encryption: FieldEncryption,
    private readonly blocklist: BlocklistService,
    private readonly audit: AuditService,
    private readonly deletionHooks: AccountDeletionHooks,
    private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.deletionHooks.register('cards', async (executor, userId) => {
      await executor
        .updateTable('cards')
        .set({
          status: 'REMOVED',
          provider_token_encrypted: null,
          is_default: false,
          removed_at: this.clock.now(),
        })
        .where('user_id', '=', userId)
        .where('status', 'in', ['ACTIVE', 'BLOCKED'])
        .execute();
    });
  }

  async startSetup(user: AuthenticatedUser, returnTo: 'APP' | 'WEB' = 'APP') {
    const returnUrl =
      returnTo === 'WEB'
        ? `${this.config.web.baseUrl}${WEB_CARD_SETUP_RETURN_PATH}`
        : CARD_SETUP_RETURN_URL;
    const rules = (await this.configuration.get('CARD_RULES')).value;
    await this.assertBelowLimit(this.db, user.userId, rules.maxActiveCards);
    const profile = await this.db
      .selectFrom('users')
      .select('country_of_residence')
      .where('id', '=', user.userId)
      .executeTakeFirstOrThrow();
    const session = await this.provider.callForClient(
      'CARD_SETUP_TOKENISATION',
      'card_setup_create',
      (provider) =>
        provider.createCardSetup({
          setupRef: user.userId,
          customerCountry: profile.country_of_residence,
          returnUrl,
        }),
    );
    const row = await this.db
      .insertInto('card_setup_sessions')
      .values({
        user_id: user.userId,
        provider: this.provider.name,
        provider_setup_id: session.providerSetupId,
        expires_at: session.expiresAt,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return {
      setupId: row.id,
      hostedUrl: session.hostedUrl,
      returnUrlPrefix: returnUrl,
      expiresAt: session.expiresAt.toISOString(),
      simulated: this.provider.simulated,
    };
  }

  /** Finishes a setup. Idempotent: completing the same setup twice returns the same card. */
  async completeSetup(user: AuthenticatedUser, setupId: string): Promise<CardView> {
    const session = await this.db
      .selectFrom('card_setup_sessions')
      .selectAll()
      .where('id', '=', setupId)
      .where('user_id', '=', user.userId)
      .executeTakeFirst();
    if (!session) {
      throw new AppError('NOT_FOUND');
    }
    if (session.status === 'COMPLETED' && session.card_id) {
      return this.view(
        await this.db
          .selectFrom('cards')
          .selectAll()
          .where('id', '=', session.card_id)
          .executeTakeFirstOrThrow(),
      );
    }
    if (session.status !== 'CREATED' || session.expires_at <= this.clock.now()) {
      throw new AppError('CARD_SETUP_FAILED', 'This card setup has expired. Please start again.');
    }
    const result = await this.provider.callForClient(
      'CARD_SETUP_TOKENISATION',
      'card_setup_result',
      (provider) => provider.getCardSetupResult(session.provider_setup_id),
    );
    if (result.status === 'PENDING') {
      throw new AppError('CARD_SETUP_INCOMPLETE');
    }
    if (result.status === 'FAILED') {
      await this.db
        .updateTable('card_setup_sessions')
        .set({ status: 'FAILED', completed_at: this.clock.now() })
        .where('id', '=', session.id)
        .execute();
      throw new AppError('CARD_SETUP_FAILED', undefined, { reason: result.reason });
    }

    const card = result.card;
    const rules = (await this.configuration.get('CARD_RULES')).value;
    return this.db
      .transaction()
      .execute(async (trx) => {
        // Serialise per user so the 3-card limit holds under concurrent completions.
        const profile = await trx
          .selectFrom('users')
          .select(['country_of_residence', 'full_name'])
          .where('id', '=', user.userId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        if (card.fingerprint) {
          const existing = await trx
            .selectFrom('cards')
            .selectAll()
            .where('user_id', '=', user.userId)
            .where('fingerprint', '=', card.fingerprint)
            .where('status', '=', 'ACTIVE')
            .executeTakeFirst();
          if (existing) {
            await trx
              .updateTable('card_setup_sessions')
              .set({ status: 'COMPLETED', completed_at: this.clock.now(), card_id: existing.id })
              .where('id', '=', session.id)
              .execute();
            return this.view(existing);
          }
        }
        const reason = checkCardEligibility(card, {
          rules,
          profileCountry: profile.country_of_residence,
          profileName: profile.full_name,
          fingerprintBlocked: await this.blocklist.isBlocked(
            'CARD_FINGERPRINT',
            card.fingerprint,
            trx,
          ),
          now: this.clock.now(),
        });
        const base = {
          user_id: user.userId,
          provider: this.provider.name,
          brand: card.brand,
          last4: card.last4,
          expiry_month: card.expiryMonth,
          expiry_year: card.expiryYear,
          issuing_country: card.issuingCountry,
          funding: card.funding,
          card_currency: card.currency,
          fingerprint: card.fingerprint,
          bin_prefix: card.binPrefix,
          is_simulated: this.provider.simulated,
        };
        if (reason) {
          // Kept for risk analysis (one card on many accounts), without the token.
          const rejected = await trx
            .insertInto('cards')
            .values({
              ...base,
              provider_token_encrypted: null,
              status: 'REJECTED',
              rejection_reason: reason,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          await trx
            .updateTable('card_setup_sessions')
            .set({ status: 'FAILED', completed_at: this.clock.now(), card_id: rejected.id })
            .where('id', '=', session.id)
            .execute();
          await this.audit.record(
            {
              action: 'card.rejected',
              entityType: 'card',
              entityId: rejected.id,
              metadata: { reason },
            },
            trx,
          );
          return { rejected: reason } as const;
        }
        await this.assertBelowLimit(trx, user.userId, rules.maxActiveCards);
        const hasDefault = await trx
          .selectFrom('cards')
          .select('id')
          .where('user_id', '=', user.userId)
          .where('status', '=', 'ACTIVE')
          .where('is_default', '=', true)
          .executeTakeFirst();
        const saved = await trx
          .insertInto('cards')
          .values({
            ...base,
            provider_token_encrypted: this.encryption.encrypt(card.token, TOKEN_CONTEXT),
            status: 'ACTIVE',
            is_default: !hasDefault,
            three_ds_verified_at: card.threeDsVerified ? this.clock.now() : null,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await trx
          .updateTable('card_setup_sessions')
          .set({ status: 'COMPLETED', completed_at: this.clock.now(), card_id: saved.id })
          .where('id', '=', session.id)
          .execute();
        await this.audit.record(
          {
            action: 'card.added',
            entityType: 'card',
            entityId: saved.id,
            after: { brand: saved.brand, last4: saved.last4 },
          },
          trx,
        );
        return this.view(saved);
      })
      .then((outcome) => {
        if ('rejected' in outcome) {
          throw new AppError('CARD_NOT_ELIGIBLE', undefined, {
            reason: outcome.rejected as string,
          });
        }
        return outcome;
      });
  }

  async list(user: AuthenticatedUser): Promise<CardView[]> {
    const rows = await this.db
      .selectFrom('cards')
      .selectAll()
      .where('user_id', '=', user.userId)
      .where('status', '=', 'ACTIVE')
      .orderBy('is_default', 'desc')
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((row) => this.view(row));
  }

  async makeDefault(user: AuthenticatedUser, cardId: string): Promise<CardView> {
    return this.db.transaction().execute(async (trx) => {
      const card = await this.ownedActive(trx, user.userId, cardId);
      await trx
        .updateTable('cards')
        .set({ is_default: false })
        .where('user_id', '=', user.userId)
        .where('is_default', '=', true)
        .execute();
      const updated = await trx
        .updateTable('cards')
        .set({ is_default: true })
        .where('id', '=', card.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return this.view(updated);
    });
  }

  async remove(user: AuthenticatedUser, cardId: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const card = await this.ownedActive(trx, user.userId, cardId);
      await trx
        .updateTable('cards')
        .set({
          status: 'REMOVED',
          provider_token_encrypted: null,
          is_default: false,
          removed_at: this.clock.now(),
        })
        .where('id', '=', card.id)
        .execute();
      if (card.is_default) {
        const next = await trx
          .selectFrom('cards')
          .select('id')
          .where('user_id', '=', user.userId)
          .where('status', '=', 'ACTIVE')
          .orderBy('created_at', 'desc')
          .executeTakeFirst();
        if (next) {
          await trx
            .updateTable('cards')
            .set({ is_default: true })
            .where('id', '=', next.id)
            .execute();
        }
      }
      await this.audit.record(
        { action: 'card.removed', entityType: 'card', entityId: card.id },
        trx,
      );
    });
  }

  /** For the payment orchestrator: the decrypted partner token of an active card. */
  async tokenFor(cardId: string, executor: Executor = this.db): Promise<string> {
    const card = await executor
      .selectFrom('cards')
      .select(['provider_token_encrypted', 'status'])
      .where('id', '=', cardId)
      .executeTakeFirst();
    if (!card?.provider_token_encrypted || card.status !== 'ACTIVE') {
      throw new AppError('CARD_NOT_ACTIVE');
    }
    return this.encryption.decrypt(card.provider_token_encrypted, TOKEN_CONTEXT);
  }

  async ownedActive(
    executor: Executor,
    userId: string,
    cardId: string,
  ): Promise<Selectable<CardsTable>> {
    const card = await executor
      .selectFrom('cards')
      .selectAll()
      .where('id', '=', cardId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    // A card owned by someone else is indistinguishable from a missing one.
    if (!card || card.status === 'REMOVED' || card.status === 'REJECTED') {
      throw new AppError('NOT_FOUND');
    }
    if (card.status !== 'ACTIVE') {
      throw new AppError('CARD_NOT_ACTIVE');
    }
    return card;
  }

  view(row: Selectable<CardsTable>): CardView {
    return {
      id: row.id,
      brand: row.brand,
      last4: row.last4,
      expiryMonth: row.expiry_month,
      expiryYear: row.expiry_year,
      issuingCountry: row.issuing_country,
      cardCurrency: row.card_currency,
      isDefault: row.is_default,
      status: row.status,
      simulated: row.is_simulated,
    };
  }

  private async assertBelowLimit(executor: Executor, userId: string, max: number): Promise<void> {
    const result = await executor
      .selectFrom('cards')
      .select(sql<string>`count(*)`.as('count'))
      .where('user_id', '=', userId)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirstOrThrow();
    if (Number(result.count) >= max) {
      throw new AppError('CARD_LIMIT_REACHED', undefined, { max });
    }
  }
}
