import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { randomBytes } from 'node:crypto';
import { type AuthenticatedAdmin } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { AppConfig } from '../../config/app-config';
import { InjectDatabase } from '../../database/database.module';
import type { AdminRole, DB } from '../../database/schema';
import { FieldEncryption } from '../../shared/crypto/field-encryption';
import { SecretHasher } from '../../shared/crypto/secret-hasher';
import { generateTotpSecret, totpProvisioningUri, verifyTotp } from '../../shared/crypto/totp';
import { randomToken, sha256Hex } from '../../shared/crypto/tokens';
import { PIN_HASHER } from '../../shared/shared.module';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';
import { TokenService } from '../auth/token.service';

const MAX_PASSWORD_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;
const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_TOTP_ATTEMPTS = 5;
export const TOTP_CONTEXT = 'admin_users.totp_secret';

/**
 * Admin console identity (FR-ADM-01): email + password, then a TOTP code. Separate from tourist
 * accounts, with its own token audience and secret. Responses never reveal whether an email
 * exists or which factor failed.
 */
@Injectable()
export class AdminAuthService {
  private dummyHash: Promise<string> | undefined;

  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    @Inject(PIN_HASHER) private readonly hasher: SecretHasher,
    private readonly encryption: FieldEncryption,
    private readonly tokens: TokenService,
    private readonly config: AppConfig,
    private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ challengeToken: string; expiresAt: string }> {
    const admin = await this.db
      .selectFrom('admin_users')
      .selectAll()
      .where('email', '=', email.trim().toLowerCase())
      .executeTakeFirst();
    const now = this.clock.now();
    if (!admin || admin.status !== 'ACTIVE') {
      // Equalise timing with the real verification path.
      await this.hasher.verify(password, await this.getDummyHash());
      throw new AppError('INVALID_CREDENTIALS');
    }
    if (admin.locked_until && admin.locked_until > now) {
      throw new AppError('INVALID_CREDENTIALS');
    }
    if (!(await this.hasher.verify(password, admin.password_hash))) {
      const attempts = admin.failed_login_attempts + 1;
      await this.db
        .updateTable('admin_users')
        .set(
          attempts >= MAX_PASSWORD_ATTEMPTS
            ? { failed_login_attempts: 0, locked_until: new Date(now.getTime() + LOCK_MS) }
            : { failed_login_attempts: attempts },
        )
        .where('id', '=', admin.id)
        .execute();
      await this.audit.record({
        actor: { type: 'ADMIN', id: admin.id },
        action: 'admin.login_failed',
        entityType: 'admin_user',
        entityId: admin.id,
        metadata: { locked: attempts >= MAX_PASSWORD_ATTEMPTS },
      });
      throw new AppError('INVALID_CREDENTIALS');
    }
    const challengeToken = randomToken();
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
    await this.db
      .insertInto('admin_login_challenges')
      .values({ admin_id: admin.id, token_hash: sha256Hex(challengeToken), expires_at: expiresAt })
      .execute();
    return { challengeToken, expiresAt: expiresAt.toISOString() };
  }

  async verifyTotp(challengeToken: string, code: string) {
    const now = this.clock.now();
    const outcome = await this.db.transaction().execute(async (trx) => {
      const challenge = await trx
        .selectFrom('admin_login_challenges')
        .selectAll()
        .where('token_hash', '=', sha256Hex(challengeToken))
        .forUpdate()
        .executeTakeFirst();
      if (
        !challenge ||
        challenge.consumed_at ||
        challenge.expires_at <= now ||
        challenge.attempts >= MAX_TOTP_ATTEMPTS
      ) {
        return null;
      }
      const admin = await trx
        .selectFrom('admin_users')
        .selectAll()
        .where('id', '=', challenge.admin_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const secret = this.encryption.decrypt(admin.totp_secret_encrypted, TOTP_CONTEXT);
      const lastStep =
        admin.totp_last_used_step === null ? null : Number(admin.totp_last_used_step);
      const step = admin.status === 'ACTIVE' ? verifyTotp(secret, code, now, lastStep) : null;
      if (step === null) {
        await trx
          .updateTable('admin_login_challenges')
          .set({ attempts: challenge.attempts + 1 })
          .where('id', '=', challenge.id)
          .execute();
        return null;
      }
      await trx
        .updateTable('admin_login_challenges')
        .set({ consumed_at: now })
        .where('id', '=', challenge.id)
        .execute();
      await trx
        .updateTable('admin_users')
        .set({
          totp_last_used_step: step,
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: now,
        })
        .where('id', '=', admin.id)
        .execute();
      const refreshToken = randomToken();
      const session = await trx
        .insertInto('admin_sessions')
        .values({
          admin_id: admin.id,
          refresh_token_hash: sha256Hex(refreshToken),
          expires_at: new Date(
            now.getTime() + this.config.auth.adminRefreshTokenTtlHours * 3_600_000,
          ),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return { admin, refreshToken, sessionId: session.id };
    });
    if (!outcome) {
      throw new AppError('INVALID_CREDENTIALS');
    }
    await this.audit.record({
      actor: { type: 'ADMIN', id: outcome.admin.id },
      action: 'admin.login',
      entityType: 'admin_user',
      entityId: outcome.admin.id,
    });
    const access = await this.tokens.issueAdminToken({
      adminId: outcome.admin.id,
      sessionId: outcome.sessionId,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresIn,
      refreshToken: outcome.refreshToken,
      admin: {
        id: outcome.admin.id,
        email: outcome.admin.email,
        fullName: outcome.admin.full_name,
        role: outcome.admin.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    const now = this.clock.now();
    const result = await this.db.transaction().execute(async (trx) => {
      const session = await trx
        .selectFrom('admin_sessions')
        .innerJoin('admin_users', 'admin_users.id', 'admin_sessions.admin_id')
        .select([
          'admin_sessions.id',
          'admin_sessions.admin_id',
          'admin_sessions.revoked_at',
          'admin_sessions.expires_at',
          'admin_users.status',
        ])
        .where('admin_sessions.refresh_token_hash', '=', sha256Hex(refreshToken))
        .forUpdate()
        .executeTakeFirst();
      if (
        !session ||
        session.revoked_at ||
        session.expires_at <= now ||
        session.status !== 'ACTIVE'
      ) {
        return null;
      }
      const next = randomToken();
      await trx
        .updateTable('admin_sessions')
        .set({ refresh_token_hash: sha256Hex(next), last_used_at: now })
        .where('id', '=', session.id)
        .execute();
      return { adminId: session.admin_id, sessionId: session.id, refreshToken: next };
    });
    if (!result) {
      throw new AppError('SESSION_REVOKED');
    }
    const access = await this.tokens.issueAdminToken({
      adminId: result.adminId,
      sessionId: result.sessionId,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresIn,
      refreshToken: result.refreshToken,
    };
  }

  async logout(admin: AuthenticatedAdmin): Promise<void> {
    await this.db
      .updateTable('admin_sessions')
      .set({ revoked_at: this.clock.now(), revoked_reason: 'LOGOUT' })
      .where('id', '=', admin.sessionId)
      .execute();
  }

  /**
   * Creates an admin with a random initial password and a TOTP secret, both returned ONCE to the
   * creator for out-of-band hand-over. Neither is stored in recoverable form except the
   * encrypted TOTP secret.
   */
  async createAdmin(input: {
    email: string;
    fullName: string;
    role: AdminRole;
    createdBy: string;
  }) {
    const password = randomBytes(18).toString('base64url');
    const totpSecret = generateTotpSecret();
    const email = input.email.trim().toLowerCase();
    const existing = await this.db
      .selectFrom('admin_users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst();
    if (existing) {
      throw new AppError('CONFLICT', 'An administrator with this email already exists.');
    }
    const row = await this.db
      .insertInto('admin_users')
      .values({
        email,
        full_name: input.fullName.trim(),
        role: input.role,
        password_hash: await this.hasher.hash(password),
        totp_secret_encrypted: this.encryption.encrypt(totpSecret, TOTP_CONTEXT),
        created_by: input.createdBy,
      })
      .returning(['id', 'email', 'role'])
      .executeTakeFirstOrThrow();
    await this.audit.record({
      action: 'admin.created',
      entityType: 'admin_user',
      entityId: row.id,
      after: { email: row.email, role: row.role },
    });
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      initialPassword: password,
      totpSecret,
      totpProvisioningUri: totpProvisioningUri(totpSecret, row.email),
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomToken());
    return this.dummyHash;
  }
}
