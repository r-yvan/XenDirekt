import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { AppError } from '../../common/errors/app-error';
import { maskEmail, maskName } from '../../common/logging/masking';
import { AppConfig } from '../../config/app-config';
import { InjectDatabase } from '../../database/database.module';
import type { DB, LaunchPersona } from '../../database/schema';
import { OutboxHandlerRegistry } from '../../jobs/outbox/outbox-handler.registry';
import { OutboxService } from '../../jobs/outbox/outbox.service';
import { DONE, HandlerResult, NonRetryableJobError } from '../../jobs/outbox/outbox.types';
import { Clock } from '../../shared/time/clock';
import { EmailSender } from '../notifications/channels/channel.types';
import {
  firstNameOf,
  generateReferralCode,
  manageToken,
  normaliseEmail,
  REFERRAL_BOOST,
  REFERRAL_CODE_PATTERN,
  verifyManageToken,
} from './domain/waitlist';
import { waitlistWelcomeMessage } from './templates/waitlist.template';

export const WAITLIST_WELCOME_JOB = 'launch.waitlist_welcome';

export interface JoinWaitlistInput {
  email: string;
  fullName?: string;
  persona?: LaunchPersona;
  countryCode?: string;
  referralCode?: string;
  source?: string;
  locale: 'en' | 'fr';
}

/** What the website shows after joining, and on the public "your spot" page. No personal data. */
export interface WaitlistStatusView {
  referralCode: string;
  position: number;
  total: number;
  referrals: number;
  referralBoost: number;
  shareUrl: string;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const pgError = error as { code?: string; constraint?: string };
  return pgError?.code === '23505' && pgError.constraint === constraint;
}

/**
 * The pre-launch waitlist. Joining is idempotent per email address: joining again answers with
 * the existing spot. The public position is derived from join order, and each friend who joins
 * with someone's referral link moves them up REFERRAL_BOOST places.
 */
@Injectable()
export class WaitlistService implements OnModuleInit {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly config: AppConfig,
    private readonly outbox: OutboxService,
    private readonly registry: OutboxHandlerRegistry,
    private readonly email: EmailSender,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      type: WAITLIST_WELCOME_JOB,
      handle: (event) =>
        this.sendWelcome(String((event.payload as { entryId?: string }).entryId ?? '')),
    });
  }

  async join(
    input: JoinWaitlistInput,
  ): Promise<{ view: WaitlistStatusView & { alreadyJoined: boolean }; created: boolean }> {
    const email = normaliseEmail(input.email);
    const existing = await this.findIdByEmail(email);
    if (existing) {
      return { view: { ...(await this.statusOf(existing)), alreadyJoined: true }, created: false };
    }
    const referrer = input.referralCode
      ? await this.db
          .selectFrom('waitlist_entries')
          .select('id')
          .where('referral_code', '=', input.referralCode)
          .executeTakeFirst()
      : undefined;
    const fullName = input.fullName?.trim().replace(/\s+/g, ' ') || null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const id = await this.db.transaction().execute(async (trx) => {
          const row = await trx
            .insertInto('waitlist_entries')
            .values({
              email,
              full_name: fullName,
              persona: input.persona ?? null,
              country_code: input.countryCode?.toUpperCase() ?? null,
              locale: input.locale,
              referral_code: generateReferralCode(),
              referred_by: referrer?.id ?? null,
              source: input.source ?? null,
              privacy_version: this.config.legal.privacyVersion,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          await this.outbox.enqueue(trx, {
            type: WAITLIST_WELCOME_JOB,
            aggregateType: 'waitlist_entry',
            aggregateId: row.id,
            payload: { entryId: row.id },
            dedupeKey: `waitlist-welcome:${row.id}`,
            maxAttempts: 5,
          });
          return row.id;
        });
        return { view: { ...(await this.statusOf(id)), alreadyJoined: false }, created: true };
      } catch (error) {
        if (isUniqueViolation(error, 'waitlist_entries_email_key')) {
          // A concurrent join for the same address won the race: answer with that spot.
          const winner = await this.findIdByEmail(email);
          if (winner) {
            return {
              view: { ...(await this.statusOf(winner)), alreadyJoined: true },
              created: false,
            };
          }
        }
        if (!isUniqueViolation(error, 'waitlist_entries_referral_code_key')) {
          throw error;
        }
        // Referral code collision (~1 in 10^11): try again with a new code.
      }
    }
    throw new AppError('INTERNAL_ERROR');
  }

  /** The public "your spot" page, keyed by the shareable referral code. */
  async statusByReferralCode(code: string): Promise<WaitlistStatusView> {
    if (!REFERRAL_CODE_PATTERN.test(code)) {
      throw new AppError('NOT_FOUND');
    }
    const row = await this.db
      .selectFrom('waitlist_entries')
      .select('id')
      .where('referral_code', '=', code)
      .executeTakeFirst();
    if (!row) {
      throw new AppError('NOT_FOUND');
    }
    return this.statusOf(row.id);
  }

  /** "Leave the list and delete my details", from the email link. Deletes the entry. */
  async leave(token: string): Promise<void> {
    const entryId = verifyManageToken(this.config.auth.otpHmacSecret, token);
    if (!entryId) {
      throw new AppError('NOT_FOUND');
    }
    const deleted = await this.db
      .deleteFrom('waitlist_entries')
      .where('id', '=', entryId)
      .executeTakeFirst();
    if (Number(deleted.numDeletedRows) === 0) {
      throw new AppError('NOT_FOUND');
    }
  }

  async total(): Promise<number> {
    const row = await this.db
      .selectFrom('waitlist_entries')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .executeTakeFirstOrThrow();
    return Number(row.total);
  }

  /** Operations view; email and name are masked without `personal-data:unmasked`. */
  async listForAdmin(
    query: { cursor?: string; limit?: number; persona?: LaunchPersona },
    unmasked: boolean,
  ) {
    const limit = query.limit ?? 50;
    const cursor = query.cursor ? BigInt(query.cursor) : null;
    const persona = query.persona ?? null;
    const rows = await sql<{
      id: string;
      seq: bigint;
      email: string;
      full_name: string | null;
      persona: LaunchPersona | null;
      country_code: string | null;
      locale: string;
      referral_code: string;
      source: string | null;
      referrals: number;
      position: number;
      welcome_sent_at: Date | null;
      created_at: Date;
    }>`
      WITH referral_counts AS (
        SELECT referred_by AS id, count(*)::int AS referrals
        FROM waitlist_entries
        WHERE referred_by IS NOT NULL
        GROUP BY referred_by
      ),
      ranked AS (
        SELECT e.*, COALESCE(r.referrals, 0) AS referrals,
               (row_number() OVER (
                 ORDER BY e.seq - ${REFERRAL_BOOST} * COALESCE(r.referrals, 0), e.seq
               ))::int AS position
        FROM waitlist_entries e
        LEFT JOIN referral_counts r ON r.id = e.id
      )
      SELECT id, seq, email, full_name, persona, country_code, locale, referral_code, source,
             referrals, position, welcome_sent_at, created_at
      FROM ranked
      WHERE (${cursor}::bigint IS NULL OR seq < ${cursor}::bigint)
        AND (${persona}::text IS NULL OR persona = ${persona}::text)
      ORDER BY seq DESC
      LIMIT ${limit + 1}
    `.execute(this.db);
    const page = rows.rows.slice(0, limit);
    const last = page.at(-1);
    return {
      total: await this.total(),
      entries: page.map((row) => ({
        id: row.id,
        position: row.position,
        email: unmasked ? row.email : maskEmail(row.email),
        fullName: unmasked ? row.full_name : maskName(row.full_name),
        persona: row.persona,
        countryCode: row.country_code,
        locale: row.locale,
        referralCode: row.referral_code,
        referrals: row.referrals,
        source: row.source,
        welcomeEmailSent: row.welcome_sent_at !== null,
        joinedAt: row.created_at.toISOString(),
      })),
      nextCursor: rows.rows.length > limit && last ? String(last.seq) : null,
    };
  }

  private async findIdByEmail(email: string): Promise<string | null> {
    const row = await this.db
      .selectFrom('waitlist_entries')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst();
    return row?.id ?? null;
  }

  private async statusOf(entryId: string): Promise<WaitlistStatusView> {
    const result = await sql<{
      referral_code: string;
      referrals: number;
      position: number;
      total: number;
    }>`
      WITH referral_counts AS (
        SELECT referred_by AS id, count(*)::int AS referrals
        FROM waitlist_entries
        WHERE referred_by IS NOT NULL
        GROUP BY referred_by
      ),
      ranked AS (
        SELECT e.id, e.seq, e.referral_code, COALESCE(r.referrals, 0) AS referrals,
               e.seq - ${REFERRAL_BOOST} * COALESCE(r.referrals, 0) AS score
        FROM waitlist_entries e
        LEFT JOIN referral_counts r ON r.id = e.id
      )
      SELECT me.referral_code, me.referrals,
             ((SELECT count(*) FROM ranked o
                WHERE o.score < me.score OR (o.score = me.score AND o.seq < me.seq)) + 1)::int
               AS position,
             (SELECT count(*) FROM waitlist_entries)::int AS total
      FROM ranked me
      WHERE me.id = ${entryId}
    `.execute(this.db);
    const row = result.rows[0];
    if (!row) {
      throw new AppError('NOT_FOUND');
    }
    return {
      referralCode: row.referral_code,
      position: row.position,
      total: row.total,
      referrals: row.referrals,
      referralBoost: REFERRAL_BOOST,
      shareUrl: this.shareUrl(row.referral_code),
    };
  }

  private shareUrl(code: string): string {
    return `${this.config.web.baseUrl}/?ref=${code}`;
  }

  /** Outbox job: one welcome email per entry. Skipped (not failed) when email is disabled. */
  private async sendWelcome(entryId: string): Promise<HandlerResult> {
    if (!entryId) {
      throw new NonRetryableJobError('waitlist welcome job without entryId');
    }
    const entry = await this.db
      .selectFrom('waitlist_entries')
      .select(['id', 'email', 'full_name', 'locale', 'referral_code', 'welcome_sent_at'])
      .where('id', '=', entryId)
      .executeTakeFirst();
    // Left the list before the email went out, or already sent: nothing to do.
    if (!entry || entry.welcome_sent_at !== null) {
      return DONE;
    }
    if (!this.email.configured) {
      this.logger.warn({ entryId }, 'Email is not configured; waitlist welcome email skipped');
      return DONE;
    }
    const status = await this.statusOf(entry.id);
    const base = this.config.web.baseUrl;
    const message = waitlistWelcomeMessage(entry.locale, {
      firstName: firstNameOf(entry.full_name),
      position: status.position,
      shareUrl: status.shareUrl,
      statusUrl: `${base}/waitlist/${entry.referral_code}`,
      leaveUrl: `${base}/waitlist/leave?token=${manageToken(this.config.auth.otpHmacSecret, entry.id)}`,
    });
    await this.email.send({ to: entry.email, subject: message.subject, text: message.text });
    await this.db
      .updateTable('waitlist_entries')
      .set({ welcome_sent_at: this.clock.now() })
      .where('id', '=', entry.id)
      .execute();
    return DONE;
  }
}
