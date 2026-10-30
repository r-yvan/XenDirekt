import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { firstName } from '../../common/logging/masking';
import { Executor } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB, NotificationsTable, PaymentState } from '../../database/schema';
import { OutboxHandlerRegistry } from '../../jobs/outbox/outbox-handler.registry';
import { OutboxService } from '../../jobs/outbox/outbox.service';
import { DONE, NonRetryableJobError } from '../../jobs/outbox/outbox.types';
import { FieldEncryption } from '../../shared/crypto/field-encryption';
import { sha256Hex } from '../../shared/crypto/tokens';
import { Clock } from '../../shared/time/clock';
import { MetricsService } from '../health/metrics.service';
import {
  PaymentRow,
  PaymentTransitionsService,
} from '../payments/application/payment-transitions.service';
import { ChannelNotConfiguredError, EmailSender, SmsSender } from './channels/channel.types';
import { normaliseLocale } from './templates/otp.template';
import {
  merchantSms,
  PaymentMessageData,
  PaymentNotificationKind,
  touristMessage,
} from './templates/payment.templates';

export const DELIVER_JOB = 'notification.deliver';
const MAX_DELIVERY_ATTEMPTS = 5;

const KIND_BY_STATE: Partial<Record<PaymentState, PaymentNotificationKind>> = {
  COMPLETED: 'COMPLETED',
  AUTH_FAILED: 'FAILED',
  VOIDED: 'VOIDED',
  PENDING_REVIEW: 'IN_REVIEW',
  REFUNDED: 'REFUNDED',
};

/**
 * Receipts and confirmations (FR-RCP-01/02, FR-HIS-03). Created in the same transaction as the
 * payment's state change (so nothing is announced before it is committed) and delivered
 * asynchronously. Delivery failures are recorded and retried; they never alter the payment.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly transitions: PaymentTransitionsService,
    private readonly outbox: OutboxService,
    private readonly registry: OutboxHandlerRegistry,
    private readonly email: EmailSender,
    private readonly sms: SmsSender,
    private readonly encryption: FieldEncryption,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    this.transitions.onTransition((trx, payment) => this.onPaymentState(trx, payment));
    this.registry.register({
      type: DELIVER_JOB,
      handle: (event) =>
        this.deliver(String((event.payload as { notificationId?: string }).notificationId)),
    });
  }

  private async onPaymentState(trx: Executor, payment: PaymentRow): Promise<void> {
    const kind = KIND_BY_STATE[payment.state];
    if (!kind) {
      return;
    }
    // Dedupe keys (payment + template + channel) make repeated entries into a state quiet.
    const user = await trx
      .selectFrom('users')
      .select(['full_name', 'email', 'phone_e164', 'preferred_language'])
      .where('id', '=', payment.user_id)
      .executeTakeFirstOrThrow();
    const locale = normaliseLocale(user.preferred_language);
    const data = this.messageData(payment, user.full_name);
    const message = touristMessage(kind, locale, data);
    const base = {
      user_id: payment.user_id,
      payment_id: payment.id,
      template: `PAYMENT_${kind}`,
      locale,
    };

    await this.create(trx, {
      ...base,
      audience: 'TOURIST',
      channel: 'IN_APP',
      title: message.title,
      body: message.body,
      deep_link: `xendirekt://payments/${payment.id}`,
    });
    const tokens = await trx
      .selectFrom('push_tokens')
      .select('id')
      .where('user_id', '=', payment.user_id)
      .where('revoked_at', 'is', null)
      .execute();
    if (tokens.length > 0) {
      await this.create(trx, { ...base, audience: 'TOURIST', channel: 'PUSH' });
    }
    if (kind === 'COMPLETED' || kind === 'VOIDED' || kind === 'REFUNDED') {
      if (user.phone_e164) {
        await this.create(trx, { ...base, audience: 'TOURIST', channel: 'SMS' });
      }
      if (user.email) {
        await this.create(trx, { ...base, audience: 'TOURIST', channel: 'EMAIL' });
      }
    }
    if (kind === 'COMPLETED') {
      const payee = await trx
        .selectFrom('payees')
        .select('identifier_type')
        .where('id', '=', payment.payee_id)
        .executeTakeFirstOrThrow();
      if (payee.identifier_type === 'PHONE') {
        await this.create(trx, {
          ...base,
          user_id: null,
          template: 'MERCHANT_RECEIVED',
          audience: 'MERCHANT',
          channel: 'SMS',
          locale: 'en',
        });
      }
    }
  }

  private async create(
    trx: Executor,
    row: Pick<NotificationsTable, 'audience' | 'channel' | 'template'> & {
      user_id: string | null;
      payment_id: string;
      locale: string;
      title?: string;
      body?: string;
      deep_link?: string;
    },
  ): Promise<void> {
    const dedupeKey = `${row.payment_id}:${row.template}:${row.audience}:${row.channel}`;
    const inApp = row.channel === 'IN_APP';
    const inserted = await trx
      .insertInto('notifications')
      .values({
        user_id: row.user_id,
        payment_id: row.payment_id,
        audience: row.audience,
        channel: row.channel,
        template: row.template,
        locale: row.locale,
        title: row.title ?? null,
        body: row.body ?? null,
        deep_link: row.deep_link ?? null,
        dedupe_key: dedupeKey,
        status: inApp ? 'SENT' : 'PENDING',
        sent_at: inApp ? this.clock.now() : null,
      })
      .onConflict((oc) => oc.column('dedupe_key').doNothing())
      .returning('id')
      .executeTakeFirst();
    if (inserted && !inApp) {
      await this.outbox.enqueue(trx, {
        type: DELIVER_JOB,
        aggregateType: 'notification',
        aggregateId: inserted.id,
        payload: { notificationId: inserted.id },
        dedupeKey: `notification:${inserted.id}`,
        maxAttempts: MAX_DELIVERY_ATTEMPTS + 1,
      });
    }
  }

  async deliver(notificationId: string) {
    const notification = await this.db
      .selectFrom('notifications')
      .selectAll()
      .where('id', '=', notificationId)
      .executeTakeFirst();
    if (!notification) {
      throw new NonRetryableJobError('Unknown notification');
    }
    if (notification.status !== 'PENDING' || !notification.payment_id) {
      return DONE;
    }
    const payment = await this.db
      .selectFrom('payments')
      .selectAll()
      .where('id', '=', notification.payment_id)
      .executeTakeFirstOrThrow();
    try {
      const receipt = await this.send(notification, payment);
      await this.mark(notification.id, {
        status: 'SENT',
        sent_at: this.clock.now(),
        provider_message_id: receipt,
      });
    } catch (error) {
      if (error instanceof ChannelNotConfiguredError) {
        await this.mark(notification.id, {
          status: 'SUPPRESSED',
          status_reason: 'CHANNEL_NOT_CONFIGURED',
        });
        return DONE;
      }
      const attempts = notification.attempts + 1;
      if (attempts >= MAX_DELIVERY_ATTEMPTS) {
        await this.mark(notification.id, {
          status: 'FAILED',
          attempts,
          status_reason: error instanceof Error ? error.message.slice(0, 200) : 'error',
        });
        this.metrics.notificationsFailed.inc({
          channel: notification.channel,
          template: notification.template,
        });
        this.logger.warn(
          { notificationId, channel: notification.channel, alert: 'NOTIFICATION_FAILED' },
          'Notification delivery failed permanently',
        );
        return DONE;
      }
      await this.mark(notification.id, { attempts });
      throw error;
    }
    return DONE;
  }

  private async send(
    notification: Selectable<NotificationsTable>,
    payment: PaymentRow,
  ): Promise<string | null> {
    const user = await this.db
      .selectFrom('users')
      .select(['full_name', 'email', 'phone_e164'])
      .where('id', '=', payment.user_id)
      .executeTakeFirstOrThrow();
    const data = this.messageData(payment, user.full_name);
    if (notification.audience === 'MERCHANT') {
      const payee = await this.db
        .selectFrom('payees')
        .select('identifier')
        .where('id', '=', payment.payee_id)
        .executeTakeFirstOrThrow();
      return (await this.sms.send({ to: payee.identifier, text: merchantSms(data) }))
        .providerMessageId;
    }
    const kind = notification.template.replace('PAYMENT_', '') as PaymentNotificationKind;
    const message = touristMessage(kind, normaliseLocale(notification.locale), data);
    switch (notification.channel) {
      case 'SMS':
        if (!user.phone_e164) {
          throw new ChannelNotConfiguredError('SMS');
        }
        return (await this.sms.send({ to: user.phone_e164, text: `XenDirekt: ${message.body}` }))
          .providerMessageId;
      case 'EMAIL':
        if (!user.email) {
          throw new ChannelNotConfiguredError('EMAIL');
        }
        return (
          await this.email.send({
            to: user.email,
            subject: `XenDirekt: ${message.title}`,
            text: message.body,
          })
        ).providerMessageId;
      default:
        // Push needs FCM/APNs credentials (OQ-31); the in-app inbox carries the message meanwhile.
        throw new ChannelNotConfiguredError('PUSH');
    }
  }

  private async mark(
    id: string,
    update: Partial<Record<'status' | 'status_reason' | 'provider_message_id', string | null>> & {
      sent_at?: Date;
      attempts?: number;
    },
  ) {
    await this.db
      .updateTable('notifications')
      .set(update as never)
      .where('id', '=', id)
      .execute();
  }

  private messageData(payment: PaymentRow, fullName: string | null): PaymentMessageData {
    return {
      reference: payment.reference,
      amountRwf: payment.amount_rwf,
      totalCardMinor: payment.total_card_minor,
      cardCurrency: payment.card_currency,
      merchantName: payment.payee_name_snapshot,
      payerFirstName: firstName(fullName),
      note: payment.note,
      simulated: payment.is_simulated,
    };
  }

  // --- tourist inbox -------------------------------------------------------------------------

  async inbox(user: AuthenticatedUser, before?: string) {
    let query = this.db
      .selectFrom('notifications')
      .select([
        'id',
        'payment_id',
        'template',
        'title',
        'body',
        'deep_link',
        'read_at',
        'created_at',
      ])
      .where('user_id', '=', user.userId)
      .where('channel', '=', 'IN_APP')
      .orderBy('created_at', 'desc')
      .limit(30);
    if (before) {
      const date = new Date(before);
      if (Number.isNaN(date.getTime())) {
        throw new AppError('VALIDATION_FAILED', undefined, {
          fields: ['before: must be an ISO date'],
        });
      }
      query = query.where('created_at', '<', date);
    }
    const rows = await query.execute();
    return {
      notifications: rows.map((row) => ({
        id: row.id,
        paymentId: row.payment_id,
        kind: row.template,
        title: row.title,
        body: row.body,
        deepLink: row.deep_link,
        read: row.read_at !== null,
        createdAt: row.created_at.toISOString(),
      })),
      unread: rows.filter((row) => row.read_at === null).length,
    };
  }

  async markRead(user: AuthenticatedUser, id: string): Promise<void> {
    const result = await this.db
      .updateTable('notifications')
      .set({ read_at: this.clock.now() })
      .where('id', '=', id)
      .where('user_id', '=', user.userId)
      .where('read_at', 'is', null)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      const exists = await this.db
        .selectFrom('notifications')
        .select('id')
        .where('id', '=', id)
        .where('user_id', '=', user.userId)
        .executeTakeFirst();
      if (!exists) {
        throw new AppError('NOT_FOUND');
      }
    }
  }

  async registerPushToken(
    user: AuthenticatedUser,
    platform: 'ios' | 'android',
    token: string,
  ): Promise<void> {
    const hash = sha256Hex(token);
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('push_tokens')
        .set({ revoked_at: this.clock.now() })
        .where('token_hash', '=', hash)
        .where('revoked_at', 'is', null)
        .execute();
      await trx
        .insertInto('push_tokens')
        .values({
          user_id: user.userId,
          session_id: user.sessionId,
          platform,
          token_encrypted: this.encryption.encrypt(token, 'push_tokens.token'),
          token_hash: hash,
        })
        .execute();
    });
  }
}
