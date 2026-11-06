import { Injectable, Logger } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { AppError } from '../../common/errors/app-error';
import { AppConfig } from '../../config/app-config';
import { Executor } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type {
  ClientPlatform,
  DB,
  SessionRevokedReason,
  SessionsTable,
} from '../../database/schema';
import { hmacSha256Hex, randomToken, sha256Hex } from '../../shared/crypto/tokens';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';
import { TokenService } from './token.service';

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  sessionId: string;
}

export interface DeviceInfo {
  deviceId: string;
  platform?: ClientPlatform;
  appVersion?: string;
}

/** A presented refresh token within this window after rotation counts as a lost-response retry. */
const ROTATION_GRACE_MS = 30_000;

/**
 * Device-bound sessions with rotating refresh tokens (NFR-SEC-04). Refresh tokens are random
 * 256-bit values stored only as SHA-256 hashes. Presenting an already-rotated token outside the
 * grace window is treated as theft: the session is revoked.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly config: AppConfig,
    private readonly clock: Clock,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /** Device IDs are app-generated install IDs; stored only as a keyed hash. */
  hashDeviceId(deviceId: string): string {
    return hmacSha256Hex(this.config.auth.otpHmacSecret, `device:${deviceId}`);
  }

  /** One active session per device (NFR-RSK-05): signing in revokes any other session on it. */
  async create(executor: Executor, userId: string, device: DeviceInfo): Promise<TokenPair> {
    const deviceIdHash = this.hashDeviceId(device.deviceId);
    await executor
      .updateTable('sessions')
      .set({ revoked_at: this.clock.now(), revoked_reason: 'NEW_SIGN_IN_ON_DEVICE' })
      .where('device_id_hash', '=', deviceIdHash)
      .where('revoked_at', 'is', null)
      .execute();
    const refreshToken = randomToken();
    const session = await executor
      .insertInto('sessions')
      .values({
        user_id: userId,
        device_id_hash: deviceIdHash,
        platform: device.platform ?? null,
        app_version: device.appVersion ?? null,
        refresh_token_hash: sha256Hex(refreshToken),
        expires_at: this.clock.plusMs(this.config.auth.refreshTokenTtlDays * 86_400_000),
        last_used_at: this.clock.now(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const access = await this.tokens.issueUserToken({ userId, sessionId: session.id });
    return {
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresIn,
      refreshToken,
      sessionId: session.id,
    };
  }

  async refresh(refreshToken: string, deviceId: string): Promise<TokenPair> {
    const hash = sha256Hex(refreshToken);
    const deviceIdHash = this.hashDeviceId(deviceId);
    const now = this.clock.now();
    const outcome = await this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('sessions')
        .selectAll()
        .where('refresh_token_hash', '=', hash)
        .forUpdate()
        .executeTakeFirst();
      if (current) {
        return this.rotate(trx, current, deviceIdHash, now, false);
      }
      const previous = await trx
        .selectFrom('sessions')
        .selectAll()
        .where('previous_refresh_token_hash', '=', hash)
        .forUpdate()
        .executeTakeFirst();
      if (!previous) {
        return { kind: 'invalid' as const };
      }
      const withinGrace =
        previous.rotated_at !== null &&
        now.getTime() - previous.rotated_at.getTime() <= ROTATION_GRACE_MS;
      if (withinGrace) {
        return this.rotate(trx, previous, deviceIdHash, now, true);
      }
      await this.revokeRow(trx, previous.id, 'REFRESH_REUSE');
      return { kind: 'reuse' as const, sessionId: previous.id, userId: previous.user_id };
    });

    if (outcome.kind === 'reuse') {
      this.logger.warn(
        { sessionId: outcome.sessionId },
        'Refresh token reuse detected; session revoked',
      );
      await this.audit.record({
        actor: { type: 'SYSTEM' },
        action: 'session.refresh_reuse_detected',
        entityType: 'session',
        entityId: outcome.sessionId,
        metadata: { userId: outcome.userId },
      });
      throw new AppError('SESSION_REVOKED');
    }
    if (outcome.kind !== 'rotated') {
      throw new AppError('SESSION_REVOKED');
    }
    const access = await this.tokens.issueUserToken({
      userId: outcome.userId,
      sessionId: outcome.sessionId,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresIn,
      refreshToken: outcome.refreshToken,
      sessionId: outcome.sessionId,
    };
  }

  private async rotate(
    trx: Executor,
    session: Selectable<SessionsTable>,
    deviceIdHash: string,
    now: Date,
    viaGraceRetry: boolean,
  ): Promise<
    | { kind: 'rotated'; refreshToken: string; sessionId: string; userId: string }
    | { kind: 'invalid' }
    | { kind: 'reuse'; sessionId: string; userId: string }
  > {
    if (session.revoked_at !== null || session.expires_at <= now) {
      return { kind: 'invalid' };
    }
    if (session.device_id_hash !== deviceIdHash) {
      // A refresh token presented from another device is treated as stolen.
      await this.revokeRow(trx, session.id, 'REFRESH_REUSE');
      return { kind: 'reuse', sessionId: session.id, userId: session.user_id };
    }
    const user = await trx
      .selectFrom('users')
      .select('status')
      .where('id', '=', session.user_id)
      .executeTakeFirst();
    if (!user || user.status === 'BLOCKED' || user.status === 'DELETED') {
      return { kind: 'invalid' };
    }
    const refreshToken = randomToken();
    await trx
      .updateTable('sessions')
      .set(
        viaGraceRetry
          ? // Keep the original rotated-away token and rotation time: replaying it after the
            // grace window must still be detected, and retries must not extend the window.
            { refresh_token_hash: sha256Hex(refreshToken), last_used_at: now }
          : {
              previous_refresh_token_hash: session.refresh_token_hash,
              refresh_token_hash: sha256Hex(refreshToken),
              rotated_at: now,
              last_used_at: now,
            },
      )
      .where('id', '=', session.id)
      .execute();
    return { kind: 'rotated', refreshToken, sessionId: session.id, userId: session.user_id };
  }

  async revoke(
    sessionId: string,
    reason: SessionRevokedReason,
    executor: Executor = this.db,
  ): Promise<void> {
    await this.revokeRow(executor, sessionId, reason);
  }

  async revokeAllForUser(
    userId: string,
    reason: SessionRevokedReason,
    executor: Executor = this.db,
    exceptSessionId?: string,
  ): Promise<number> {
    let query = executor
      .updateTable('sessions')
      .set({ revoked_at: this.clock.now(), revoked_reason: reason })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null);
    if (exceptSessionId) {
      query = query.where('id', '!=', exceptSessionId);
    }
    const result = await query.executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  private async revokeRow(
    executor: Executor,
    sessionId: string,
    reason: SessionRevokedReason,
  ): Promise<void> {
    await executor
      .updateTable('sessions')
      .set({ revoked_at: this.clock.now(), revoked_reason: reason })
      .where('id', '=', sessionId)
      .where('revoked_at', 'is', null)
      .execute();
  }
}
