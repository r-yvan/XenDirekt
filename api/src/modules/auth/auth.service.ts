import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { parseDevicePublicKey, DeviceKeyAlgorithm } from '../../shared/crypto/signatures';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';
import { ConsentsService } from '../consents/consents.service';
import { ProfileView, UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { DeviceInfo, SessionService, TokenPair } from './session.service';
import { StepUpService } from './step-up.service';

export interface SignInResult extends TokenPair {
  isNewUser: boolean;
  user: ProfileView;
}

/** Sign-in orchestration: verified one-time code → find or create the user → device session. */
@Injectable()
export class AuthService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly stepUp: StepUpService,
    private readonly users: UsersService,
    private readonly consents: ConsentsService,
    private readonly audit: AuditService,
  ) {}

  async verifyOtpAndSignIn(
    challengeId: string,
    code: string,
    device: DeviceInfo,
  ): Promise<SignInResult> {
    const verified = await this.otp.verify(challengeId, code);
    const now = this.clock.now();
    const column = verified.channel === 'EMAIL' ? 'email' : 'phone_e164';
    const verifiedColumn = verified.channel === 'EMAIL' ? 'email_verified_at' : 'phone_verified_at';

    const { userId, isNewUser, status, tokens } = await this.db
      .transaction()
      .execute(async (trx) => {
        let user = await trx
          .selectFrom('users')
          .select(['id', 'status'])
          .where(column, '=', verified.destination)
          .forUpdate()
          .executeTakeFirst();
        let created = false;
        if (!user) {
          user = await trx
            .insertInto('users')
            .values({ [column]: verified.destination, [verifiedColumn]: now })
            .onConflict((oc) => oc.column(column).where(column, 'is not', null).doNothing())
            .returning(['id', 'status'])
            .executeTakeFirst();
          if (!user) {
            // Concurrent first sign-in for the same destination: use the row that won.
            user = await trx
              .selectFrom('users')
              .select(['id', 'status'])
              .where(column, '=', verified.destination)
              .executeTakeFirstOrThrow();
          } else {
            created = true;
          }
        }
        if (user.status === 'BLOCKED') {
          return { userId: user.id, isNewUser: false, status: user.status, tokens: null };
        }
        const pair = await this.sessions.create(trx, user.id, device);
        return { userId: user.id, isNewUser: created, status: user.status, tokens: pair };
      });

    await this.audit.record({
      actor: { type: 'USER', id: userId },
      action: status === 'BLOCKED' ? 'auth.sign_in_blocked' : 'auth.sign_in',
      entityType: 'user',
      entityId: userId,
      metadata: { channel: verified.channel, isNewUser, platform: device.platform ?? null },
    });
    if (!tokens) {
      throw new AppError('ACCOUNT_BLOCKED');
    }
    const user = await this.users.getProfile({
      userId,
      sessionId: tokens.sessionId,
      deviceIdHash: this.sessions.hashDeviceId(device.deviceId),
      status: 'PENDING_PROFILE',
    });
    return { ...tokens, isNewUser, user };
  }

  /**
   * Registers (or replaces) the device public key for this session. Requires a PIN step-up so a
   * stolen access token alone cannot enrol an attacker's key.
   */
  async registerDeviceKey(
    user: AuthenticatedUser,
    algorithm: DeviceKeyAlgorithm,
    publicKey: string,
    stepUpToken: string | undefined,
  ): Promise<{ registered: true }> {
    try {
      parseDevicePublicKey(algorithm, publicKey);
    } catch {
      throw new AppError('VALIDATION_FAILED', undefined, {
        fields: ['publicKey: not a valid key for algorithm'],
      });
    }
    await this.db.transaction().execute(async (trx) => {
      await this.stepUp.consume(trx, user, 'REGISTER_DEVICE_KEY', stepUpToken);
      await trx
        .updateTable('device_keys')
        .set({ revoked_at: this.clock.now() })
        .where('session_id', '=', user.sessionId)
        .where('revoked_at', 'is', null)
        .execute();
      await trx
        .insertInto('device_keys')
        .values({
          user_id: user.userId,
          session_id: user.sessionId,
          algorithm,
          public_key: publicKey,
        })
        .execute();
      await this.audit.record(
        {
          action: 'auth.device_key_registered',
          entityType: 'session',
          entityId: user.sessionId,
          metadata: { algorithm },
        },
        trx,
      );
    });
    return { registered: true };
  }

  async revokeDeviceKey(user: AuthenticatedUser): Promise<void> {
    await this.db
      .updateTable('device_keys')
      .set({ revoked_at: this.clock.now() })
      .where('session_id', '=', user.sessionId)
      .where('revoked_at', 'is', null)
      .execute();
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.sessions.revoke(user.sessionId, 'LOGOUT');
    await this.revokeDeviceKey(user);
  }

  get legalVersions() {
    return this.consents.currentVersions;
  }
}
