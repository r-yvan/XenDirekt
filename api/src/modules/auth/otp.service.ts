import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Kysely } from 'kysely';
import { AppError } from '../../common/errors/app-error';
import { maskEmail, maskPhone } from '../../common/logging/masking';
import { AppConfig } from '../../config/app-config';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { FieldEncryption } from '../../shared/crypto/field-encryption';
import { constantTimeEqual, hmacSha256Hex, randomNumericCode } from '../../shared/crypto/tokens';
import { normaliseInternationalPhone } from '../../shared/phone/phone';
import { Clock } from '../../shared/time/clock';
import {
  ChannelNotConfiguredError,
  EmailSender,
  SmsSender,
} from '../notifications/channels/channel.types';
import { Locale, otpMessage } from '../notifications/templates/otp.template';

export type OtpChannel = 'EMAIL' | 'SMS';

/** PRD FR-ONB-02: 6 digits, 5-minute expiry, at most 5 attempts. */
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30_000;

export interface OtpRequest {
  channel: OtpChannel;
  destination: string;
  locale: Locale;
  deviceIdHash: string | null;
}

export interface OtpChallengeView {
  challengeId: string;
  destinationMasked: string;
  expiresAt: string;
  resendAvailableAt: string;
  codeLength: number;
}

export interface VerifiedDestination {
  channel: OtpChannel;
  destination: string;
}

const ENCRYPTION_CONTEXT = 'otp_challenges.destination';

/**
 * One-time codes. Only an HMAC of the code (keyed by a server secret and bound to the challenge
 * ID) is stored; the code itself exists in memory just long enough to be sent, and is never logged.
 * Responses are identical whether or not an account exists (no account enumeration).
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly config: AppConfig,
    private readonly clock: Clock,
    private readonly encryption: FieldEncryption,
    private readonly email: EmailSender,
    private readonly sms: SmsSender,
  ) {}

  normaliseDestination(channel: OtpChannel, raw: string): string {
    if (channel === 'EMAIL') {
      const email = raw.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
        throw new AppError('VALIDATION_FAILED', undefined, {
          fields: ['destination: must be a valid email'],
        });
      }
      return email;
    }
    const phone = normaliseInternationalPhone(raw);
    if (!phone) {
      throw new AppError('VALIDATION_FAILED', undefined, {
        fields: ['destination: must be an international phone number starting with +'],
      });
    }
    return phone;
  }

  async request(input: OtpRequest): Promise<OtpChallengeView> {
    const destination = this.normaliseDestination(input.channel, input.destination);
    const sender = input.channel === 'EMAIL' ? this.email : this.sms;
    if (!sender.configured) {
      throw new AppError('CAPABILITY_NOT_CONFIGURED', 'This sign-in method is not available yet.');
    }
    const destinationHash = this.destinationHash(input.channel, destination);
    const now = this.clock.now();

    const latest = await this.db
      .selectFrom('otp_challenges')
      .select('created_at')
      .where('destination_hash', '=', destinationHash)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    if (latest && now.getTime() - latest.created_at.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (now.getTime() - latest.created_at.getTime())) / 1000,
      );
      throw new AppError('RATE_LIMITED', undefined, { retryAfterSeconds });
    }

    const challengeId = randomUUID();
    const code = randomNumericCode(OTP_LENGTH);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const masked = input.channel === 'EMAIL' ? maskEmail(destination) : maskPhone(destination);

    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('otp_challenges')
        .set({ invalidated_at: now, destination_encrypted: null })
        .where('destination_hash', '=', destinationHash)
        .where('consumed_at', 'is', null)
        .where('invalidated_at', 'is', null)
        .execute();
      await trx
        .insertInto('otp_challenges')
        .values({
          id: challengeId,
          channel: input.channel,
          destination_hash: destinationHash,
          destination_encrypted: this.encryption.encrypt(destination, ENCRYPTION_CONTEXT),
          destination_masked: masked ?? '***',
          code_hash: this.codeHash(challengeId, code),
          locale: input.locale,
          max_attempts: OTP_MAX_ATTEMPTS,
          expires_at: expiresAt,
          device_id_hash: input.deviceIdHash,
          created_at: now,
        })
        .execute();
    });

    try {
      const message = otpMessage(input.locale, code, OTP_TTL_MS / 60_000);
      if (input.channel === 'EMAIL') {
        await this.email.send({ to: destination, subject: message.subject, text: message.text });
      } else {
        await this.sms.send({ to: destination, text: message.text });
      }
    } catch (error) {
      await this.db
        .updateTable('otp_challenges')
        .set({ invalidated_at: this.clock.now(), destination_encrypted: null })
        .where('id', '=', challengeId)
        .execute();
      this.logger.warn({ channel: input.channel, err: error }, 'One-time code delivery failed');
      throw new AppError(
        error instanceof ChannelNotConfiguredError
          ? 'CAPABILITY_NOT_CONFIGURED'
          : 'PROVIDER_UNAVAILABLE',
        'We could not send your code. Please try again.',
      );
    }

    return {
      challengeId,
      destinationMasked: masked ?? '***',
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS).toISOString(),
      codeLength: OTP_LENGTH,
    };
  }

  /**
   * Verifies a code. Wrong codes consume an attempt, committed even though the request fails.
   * A correct code consumes the challenge, so it can never be replayed.
   */
  async verify(challengeId: string, code: string): Promise<VerifiedDestination> {
    const now = this.clock.now();
    const result = await this.db.transaction().execute(async (trx) => {
      const challenge = await trx
        .selectFrom('otp_challenges')
        .selectAll()
        .where('id', '=', challengeId)
        .forUpdate()
        .executeTakeFirst();
      if (
        !challenge ||
        challenge.consumed_at ||
        challenge.invalidated_at ||
        challenge.expires_at <= now
      ) {
        return { kind: 'expired' as const };
      }
      if (challenge.attempts >= challenge.max_attempts) {
        return { kind: 'exhausted' as const };
      }
      if (
        !/^\d{6}$/.test(code) ||
        !constantTimeEqual(challenge.code_hash, this.codeHash(challenge.id, code))
      ) {
        const attempts = challenge.attempts + 1;
        await trx
          .updateTable('otp_challenges')
          .set({
            attempts,
            ...(attempts >= challenge.max_attempts
              ? { invalidated_at: now, destination_encrypted: null }
              : {}),
          })
          .where('id', '=', challenge.id)
          .execute();
        return attempts >= challenge.max_attempts
          ? ({ kind: 'exhausted' } as const)
          : ({ kind: 'invalid', remaining: challenge.max_attempts - attempts } as const);
      }
      if (!challenge.destination_encrypted) {
        return { kind: 'expired' as const };
      }
      await trx
        .updateTable('otp_challenges')
        .set({ consumed_at: now, destination_encrypted: null })
        .where('id', '=', challenge.id)
        .execute();
      return {
        kind: 'ok' as const,
        channel: challenge.channel,
        destination: this.encryption.decrypt(challenge.destination_encrypted, ENCRYPTION_CONTEXT),
      };
    });

    switch (result.kind) {
      case 'ok':
        return { channel: result.channel, destination: result.destination };
      case 'invalid':
        throw new AppError('OTP_INVALID', undefined, { attemptsRemaining: result.remaining });
      case 'exhausted':
        throw new AppError('OTP_ATTEMPTS_EXCEEDED');
      default:
        throw new AppError('OTP_EXPIRED');
    }
  }

  private destinationHash(channel: OtpChannel, destination: string): string {
    return hmacSha256Hex(this.config.auth.otpHmacSecret, `${channel}:${destination}`);
  }

  private codeHash(challengeId: string, code: string): string {
    return hmacSha256Hex(this.config.auth.otpHmacSecret, `otp:${challengeId}:${code}`);
  }
}
