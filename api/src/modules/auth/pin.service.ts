import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { AppError } from '../../common/errors/app-error';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { SecretHasher } from '../../shared/crypto/secret-hasher';
import { PIN_HASHER } from '../../shared/shared.module';
import { Clock } from '../../shared/time/clock';
import { checkPinPolicy, PIN_LOCK_MS, PIN_MAX_ATTEMPTS } from './domain/pin-policy';

/**
 * Server-verified PIN (peppered Argon2id, ADR 0005). Five wrong attempts lock PIN use for
 * 15 minutes. Failed attempts are recorded in their own statement so they persist even though
 * the request fails.
 */
@Injectable()
export class PinService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    @Inject(PIN_HASHER) private readonly hasher: SecretHasher,
    private readonly clock: Clock,
  ) {}

  assertPolicy(pin: string): void {
    const violation = checkPinPolicy(pin);
    if (violation === 'FORMAT') {
      throw new AppError('VALIDATION_FAILED', undefined, {
        fields: ['pin: must be exactly 6 digits'],
      });
    }
    if (violation === 'TRIVIAL') {
      throw new AppError('VALIDATION_FAILED', 'Choose a PIN that is harder to guess.', {
        fields: ['pin: too easy to guess'],
      });
    }
  }

  async setInitial(userId: string, pin: string): Promise<void> {
    this.assertPolicy(pin);
    const hash = await this.hasher.hash(pin);
    const result = await this.db
      .updateTable('users')
      .set({
        pin_hash: hash,
        pin_set_at: this.clock.now(),
        pin_failed_attempts: 0,
        pin_locked_until: null,
      })
      .where('id', '=', userId)
      .where('pin_hash', 'is', null)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) === 0) {
      throw new AppError('CONFLICT', 'A PIN is already set. Use change PIN instead.');
    }
  }

  async change(userId: string, newPin: string): Promise<void> {
    this.assertPolicy(newPin);
    const hash = await this.hasher.hash(newPin);
    await this.db
      .updateTable('users')
      .set({
        pin_hash: hash,
        pin_set_at: this.clock.now(),
        pin_failed_attempts: 0,
        pin_locked_until: null,
      })
      .where('id', '=', userId)
      .execute();
  }

  /** Throws PIN_NOT_SET, PIN_LOCKED or PIN_INVALID (with attemptsRemaining). */
  async verify(userId: string, pin: string): Promise<void> {
    const user = await this.db
      .selectFrom('users')
      .select(['pin_hash', 'pin_failed_attempts', 'pin_locked_until'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user?.pin_hash) {
      throw new AppError('PIN_NOT_SET');
    }
    const now = this.clock.now();
    if (user.pin_locked_until && user.pin_locked_until > now) {
      throw new AppError('PIN_LOCKED', undefined, {
        retryAfterSeconds: Math.ceil((user.pin_locked_until.getTime() - now.getTime()) / 1000),
      });
    }
    const valid = /^\d{6}$/.test(pin) && (await this.hasher.verify(pin, user.pin_hash));
    if (valid) {
      if (user.pin_failed_attempts > 0 || user.pin_locked_until) {
        await this.db
          .updateTable('users')
          .set({ pin_failed_attempts: 0, pin_locked_until: null })
          .where('id', '=', userId)
          .execute();
      }
      return;
    }
    // Atomic increment so concurrent guesses cannot exceed the limit.
    const updated = await this.db
      .updateTable('users')
      .set((eb) => ({ pin_failed_attempts: eb('pin_failed_attempts', '+', 1) }))
      .where('id', '=', userId)
      .returning('pin_failed_attempts')
      .executeTakeFirstOrThrow();
    if (updated.pin_failed_attempts >= PIN_MAX_ATTEMPTS) {
      await this.db
        .updateTable('users')
        .set({ pin_failed_attempts: 0, pin_locked_until: new Date(now.getTime() + PIN_LOCK_MS) })
        .where('id', '=', userId)
        .execute();
      throw new AppError('PIN_LOCKED', undefined, { retryAfterSeconds: PIN_LOCK_MS / 1000 });
    }
    throw new AppError('PIN_INVALID', undefined, {
      attemptsRemaining: PIN_MAX_ATTEMPTS - updated.pin_failed_attempts,
    });
  }
}
