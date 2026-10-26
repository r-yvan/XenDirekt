import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { AppConfig } from '../../config/app-config';
import { Executor } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { hmacSha256Hex } from '../../shared/crypto/tokens';
import { Clock } from '../../shared/time/clock';

export interface ConsentContext {
  locale: string;
  appVersion?: string;
  ip?: string;
}

/** Timestamped Terms and Privacy acceptance (FR-ONB-03, NFR-SEC-08). Re-accepting is a no-op. */
@Injectable()
export class ConsentsService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  get currentVersions(): { termsVersion: string; privacyVersion: string } {
    return {
      termsVersion: this.config.legal.termsVersion,
      privacyVersion: this.config.legal.privacyVersion,
    };
  }

  async recordCurrent(executor: Executor, userId: string, context: ConsentContext): Promise<void> {
    const acceptedAt = this.clock.now();
    const ipHash = context.ip
      ? hmacSha256Hex(this.config.auth.otpHmacSecret, `ip:${context.ip}`)
      : null;
    await executor
      .insertInto('consents')
      .values(
        [
          { document_type: 'TERMS', document_version: this.config.legal.termsVersion },
          { document_type: 'PRIVACY', document_version: this.config.legal.privacyVersion },
        ].map((document) => ({
          user_id: userId,
          ...document,
          accepted_at: acceptedAt,
          locale: context.locale,
          app_version: context.appVersion ?? null,
          ip_hash: ipHash,
        })) as never,
      )
      .onConflict((oc) => oc.columns(['user_id', 'document_type', 'document_version']).doNothing())
      .execute();
  }

  async latestFor(
    userId: string,
  ): Promise<{ termsVersion: string | null; privacyVersion: string | null }> {
    const rows = await this.db
      .selectFrom('consents')
      .select(['document_type', 'document_version', 'accepted_at'])
      .where('user_id', '=', userId)
      .orderBy('accepted_at', 'desc')
      .execute();
    return {
      termsVersion: rows.find((row) => row.document_type === 'TERMS')?.document_version ?? null,
      privacyVersion: rows.find((row) => row.document_type === 'PRIVACY')?.document_version ?? null,
    };
  }

  hasAcceptedCurrent(latest: {
    termsVersion: string | null;
    privacyVersion: string | null;
  }): boolean {
    return (
      latest.termsVersion === this.config.legal.termsVersion &&
      latest.privacyVersion === this.config.legal.privacyVersion
    );
  }
}
