import { Injectable } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { Executor } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB, UsersTable } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { StepUpService } from '../auth/step-up.service';
import { ConsentContext, ConsentsService } from '../consents/consents.service';
import { AccountDeletionHooks } from './account-deletion.hooks';

export interface ProfileUpdate {
  fullName?: string;
  countryOfResidence?: string;
  dateOfBirth?: string;
  preferredLanguage?: 'en' | 'fr';
  acceptLegalTerms?: boolean;
}

export interface ProfileView {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  countryOfResidence: string | null;
  dateOfBirth: string | null;
  preferredLanguage: 'en' | 'fr';
  status: 'PENDING_PROFILE' | 'ACTIVE';
  profileComplete: boolean;
  pinSet: boolean;
  biometricKeyRegistered: boolean;
  kycLevel: 'NONE' | 'BASIC' | 'VERIFIED';
  acceptedTermsVersion: string | null;
  acceptedPrivacyVersion: string | null;
  createdAt: string;
}

const MINIMUM_AGE_YEARS = 18;

/** Tourist profile, consent capture and account deletion (FR-ONB-03, FR-ONB-07). */
@Injectable()
export class UsersService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly consents: ConsentsService,
    private readonly sessions: SessionService,
    private readonly stepUp: StepUpService,
    private readonly audit: AuditService,
    private readonly deletionHooks: AccountDeletionHooks,
  ) {}

  async getProfile(user: AuthenticatedUser): Promise<ProfileView> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', user.userId)
      .executeTakeFirstOrThrow();
    const key = await this.db
      .selectFrom('device_keys')
      .select('id')
      .where('session_id', '=', user.sessionId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    return this.toView(row, await this.consents.latestFor(user.userId), key !== undefined);
  }

  /**
   * Name, country and date of birth can be set while the profile is pending; once the account
   * is active they are locked (they feed risk rules), and only the language can change.
   * Completing the profile requires accepting the current Terms and Privacy versions.
   */
  async updateProfile(
    user: AuthenticatedUser,
    update: ProfileUpdate,
    context: ConsentContext,
  ): Promise<ProfileView> {
    await this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('users')
        .selectAll()
        .where('id', '=', user.userId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const identityChange =
        update.fullName !== undefined ||
        update.countryOfResidence !== undefined ||
        update.dateOfBirth !== undefined;
      if (identityChange && current.status === 'ACTIVE') {
        throw new AppError(
          'CONFLICT',
          'Contact support to change your name, country or date of birth.',
        );
      }
      if (update.dateOfBirth !== undefined) {
        this.assertAdult(update.dateOfBirth);
      }
      const next = {
        full_name: update.fullName?.trim() ?? current.full_name,
        country_of_residence:
          update.countryOfResidence?.toUpperCase() ?? current.country_of_residence,
        date_of_birth: update.dateOfBirth ?? current.date_of_birth,
        preferred_language: update.preferredLanguage ?? current.preferred_language,
      };
      if (update.acceptLegalTerms) {
        await this.consents.recordCurrent(trx, user.userId, context);
      }
      const accepted = this.consents.hasAcceptedCurrent(
        await this.consentsWithin(trx, user.userId),
      );
      const complete =
        Boolean(next.full_name && next.country_of_residence && next.date_of_birth) && accepted;
      const status = current.status === 'PENDING_PROFILE' && complete ? 'ACTIVE' : current.status;
      await trx
        .updateTable('users')
        .set({ ...next, status })
        .where('id', '=', user.userId)
        .execute();
      if (status !== current.status) {
        await this.audit.record(
          {
            action: 'user.profile_completed',
            entityType: 'user',
            entityId: user.userId,
            actor: { type: 'USER', id: user.userId },
          },
          trx,
        );
      }
    });
    return this.getProfile(user);
  }

  /**
   * Revokes every session and anonymises personal data. Payment, consent and audit records are
   * kept, linked only to the anonymised ID, for the legally required retention period (OQ-26).
   */
  async deleteAccount(user: AuthenticatedUser, stepUpToken: string | undefined): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await this.stepUp.consume(trx, user, 'DELETE_ACCOUNT', stepUpToken);
      await this.deletionHooks.runAll(trx, user.userId);
      await trx
        .updateTable('users')
        .set({
          full_name: null,
          email: null,
          email_verified_at: null,
          phone_e164: null,
          phone_verified_at: null,
          date_of_birth: null,
          pin_hash: null,
          pin_set_at: null,
          status: 'DELETED',
          deleted_at: this.clock.now(),
        })
        .where('id', '=', user.userId)
        .execute();
      await trx.deleteFrom('user_identities').where('user_id', '=', user.userId).execute();
      await trx
        .updateTable('device_keys')
        .set({ revoked_at: this.clock.now() })
        .where('user_id', '=', user.userId)
        .where('revoked_at', 'is', null)
        .execute();
      await this.sessions.revokeAllForUser(user.userId, 'ACCOUNT_DELETED', trx);
      await this.audit.record(
        {
          action: 'user.account_deleted',
          entityType: 'user',
          entityId: user.userId,
          actor: { type: 'USER', id: user.userId },
        },
        trx,
      );
    });
  }

  private async consentsWithin(executor: Executor, userId: string) {
    const rows = await executor
      .selectFrom('consents')
      .select(['document_type', 'document_version'])
      .where('user_id', '=', userId)
      .orderBy('accepted_at', 'desc')
      .execute();
    return {
      termsVersion: rows.find((row) => row.document_type === 'TERMS')?.document_version ?? null,
      privacyVersion: rows.find((row) => row.document_type === 'PRIVACY')?.document_version ?? null,
    };
  }

  private assertAdult(dateOfBirth: string): void {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
    const birth = match ? new Date(`${dateOfBirth}T00:00:00Z`) : null;
    if (
      !birth ||
      Number.isNaN(birth.getTime()) ||
      birth.toISOString().slice(0, 10) !== dateOfBirth
    ) {
      throw new AppError('VALIDATION_FAILED', undefined, {
        fields: ['dateOfBirth: must be a valid date (YYYY-MM-DD)'],
      });
    }
    const now = this.clock.now();
    const adultFrom = new Date(
      Date.UTC(birth.getUTCFullYear() + MINIMUM_AGE_YEARS, birth.getUTCMonth(), birth.getUTCDate()),
    );
    if (adultFrom > now || birth.getUTCFullYear() < 1900) {
      throw new AppError('VALIDATION_FAILED', 'You must be at least 18 to use XenDirekt.', {
        fields: ['dateOfBirth: must be at least 18 years ago'],
      });
    }
  }

  toView(
    row: Selectable<UsersTable>,
    consents: { termsVersion: string | null; privacyVersion: string | null },
    biometricKeyRegistered: boolean,
  ): ProfileView {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone_e164,
      countryOfResidence: row.country_of_residence,
      dateOfBirth: row.date_of_birth,
      preferredLanguage: row.preferred_language,
      status: row.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_PROFILE',
      profileComplete: row.status === 'ACTIVE',
      pinSet: row.pin_hash !== null,
      biometricKeyRegistered,
      kycLevel: row.kyc_level,
      acceptedTermsVersion: consents.termsVersion,
      acceptedPrivacyVersion: consents.privacyVersion,
      createdAt: row.created_at.toISOString(),
    };
  }
}
