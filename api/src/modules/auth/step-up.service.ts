import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { Executor } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB, StepUpPurpose } from '../../database/schema';
import {
  DeviceKeyAlgorithm,
  stepUpSigningMessage,
  verifyDeviceSignature,
} from '../../shared/crypto/signatures';
import { randomToken, sha256Hex } from '../../shared/crypto/tokens';
import { Clock } from '../../shared/time/clock';
import { PinService } from './pin.service';

export const STEP_UP_TTL_MS = 2 * 60_000;
export const STEP_UP_HEADER = 'x-step-up-token';

/**
 * Re-authentication for sensitive actions (ADR 0005). A grant is single-use, bound to the session
 * and to one purpose, and valid for 2 minutes. It is obtained either by PIN (verified by the
 * server) or by a signature from the device key that biometrics unlock on the phone.
 */
@Injectable()
export class StepUpService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly pins: PinService,
  ) {}

  async createChallenge(user: AuthenticatedUser, purpose: StepUpPurpose) {
    const nonce = randomToken(24);
    const expiresAt = this.clock.plusMs(STEP_UP_TTL_MS);
    const row = await this.db
      .insertInto('step_up_challenges')
      .values({ session_id: user.sessionId, purpose, nonce, expires_at: expiresAt })
      .returning('id')
      .executeTakeFirstOrThrow();
    return {
      challengeId: row.id,
      nonce,
      purpose,
      expiresAt: expiresAt.toISOString(),
      signingMessage: stepUpSigningMessage(row.id, nonce, purpose),
    };
  }

  async grantWithPin(user: AuthenticatedUser, purpose: StepUpPurpose, pin: string) {
    await this.pins.verify(user.userId, pin);
    return this.issueGrant(user, purpose, 'PIN');
  }

  async grantWithDeviceKey(
    user: AuthenticatedUser,
    purpose: StepUpPurpose,
    challengeId: string,
    signature: string,
  ) {
    if (purpose === 'REGISTER_DEVICE_KEY') {
      // A device key cannot vouch for its own replacement; registering needs the PIN.
      throw new AppError('STEP_UP_REQUIRED', 'Use your PIN to enable biometrics.');
    }
    const now = this.clock.now();
    const verified = await this.db.transaction().execute(async (trx) => {
      const challenge = await trx
        .selectFrom('step_up_challenges')
        .selectAll()
        .where('id', '=', challengeId)
        .where('session_id', '=', user.sessionId)
        .forUpdate()
        .executeTakeFirst();
      if (
        !challenge ||
        challenge.consumed_at ||
        challenge.expires_at <= now ||
        challenge.purpose !== purpose
      ) {
        return false;
      }
      await trx
        .updateTable('step_up_challenges')
        .set({ consumed_at: now })
        .where('id', '=', challenge.id)
        .execute();
      const key = await trx
        .selectFrom('device_keys')
        .select(['algorithm', 'public_key'])
        .where('session_id', '=', user.sessionId)
        .where('revoked_at', 'is', null)
        .executeTakeFirst();
      if (!key) {
        return false;
      }
      return verifyDeviceSignature(
        key.algorithm as DeviceKeyAlgorithm,
        key.public_key,
        stepUpSigningMessage(challenge.id, challenge.nonce, challenge.purpose),
        signature,
      );
    });
    if (!verified) {
      throw new AppError(
        'STEP_UP_REQUIRED',
        'Biometric approval could not be verified. Use your PIN.',
      );
    }
    return this.issueGrant(user, purpose, 'DEVICE_KEY');
  }

  /**
   * Consumes a grant inside the caller's transaction, so the sensitive action and the grant use
   * commit or roll back together.
   */
  async consume(
    executor: Executor,
    user: AuthenticatedUser,
    purpose: StepUpPurpose,
    token: string | undefined,
  ): Promise<void> {
    if (!token) {
      throw new AppError('STEP_UP_REQUIRED');
    }
    const consumed = await executor
      .updateTable('step_up_grants')
      .set({ consumed_at: this.clock.now() })
      .where('token_hash', '=', sha256Hex(token))
      .where('session_id', '=', user.sessionId)
      .where('purpose', '=', purpose)
      .where('consumed_at', 'is', null)
      .where('expires_at', '>', this.clock.now())
      .returning('id')
      .executeTakeFirst();
    if (!consumed) {
      throw new AppError('STEP_UP_REQUIRED');
    }
  }

  private async issueGrant(
    user: AuthenticatedUser,
    purpose: StepUpPurpose,
    method: 'PIN' | 'DEVICE_KEY',
  ) {
    const token = randomToken();
    const expiresAt = this.clock.plusMs(STEP_UP_TTL_MS);
    await this.db
      .insertInto('step_up_grants')
      .values({
        session_id: user.sessionId,
        user_id: user.userId,
        token_hash: sha256Hex(token),
        purpose,
        method,
        expires_at: expiresAt,
      })
      .execute();
    return { stepUpToken: token, purpose, method, expiresAt: expiresAt.toISOString() };
  }
}
