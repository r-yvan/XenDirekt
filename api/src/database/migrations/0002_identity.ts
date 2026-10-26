import { Kysely, sql } from 'kysely';

/**
 * Identity: tourists (users), consents, one-time-code challenges, device-bound sessions,
 * biometric device keys, step-up grants, and the separate admin identity store.
 * Secrets are stored only as hashes (refresh tokens, OTPs, step-up tokens) or encrypted
 * (OTP destination until used, admin TOTP secret).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE users (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name             text NULL CHECK (full_name IS NULL OR length(full_name) BETWEEN 2 AND 120),
      email                 citext NULL,
      email_verified_at     timestamptz NULL,
      phone_e164            text NULL CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{6,14}$'),
      phone_verified_at     timestamptz NULL,
      country_of_residence  char(2) NULL CHECK (country_of_residence IS NULL OR country_of_residence ~ '^[A-Z]{2}$'),
      date_of_birth         date NULL,
      preferred_language    text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'fr')),
      pin_hash              text NULL,
      pin_set_at            timestamptz NULL,
      pin_failed_attempts   integer NOT NULL DEFAULT 0 CHECK (pin_failed_attempts >= 0),
      pin_locked_until      timestamptz NULL,
      kyc_level             text NOT NULL DEFAULT 'NONE' CHECK (kyc_level IN ('NONE', 'BASIC', 'VERIFIED')),
      kyc_status            text NOT NULL DEFAULT 'NOT_STARTED'
                              CHECK (kyc_status IN ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED')),
      status                text NOT NULL DEFAULT 'PENDING_PROFILE'
                              CHECK (status IN ('PENDING_PROFILE', 'ACTIVE', 'BLOCKED', 'DELETED')),
      blocked_reason        text NULL,
      blocked_at            timestamptz NULL,
      deleted_at            timestamptz NULL,
      created_at            timestamptz NOT NULL DEFAULT now(),
      updated_at            timestamptz NOT NULL DEFAULT now(),
      CHECK (status = 'DELETED' OR email IS NOT NULL OR phone_e164 IS NOT NULL),
      CHECK (status <> 'BLOCKED' OR blocked_at IS NOT NULL)
    );
    CREATE UNIQUE INDEX ux_users_email ON users (email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX ux_users_phone ON users (phone_e164) WHERE phone_e164 IS NOT NULL;
    CREATE INDEX ix_users_created_at ON users (created_at DESC);
    CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    -- Apple / Google sign-in links (feature-flagged; see ADR 0005).
    CREATE TABLE user_identities (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES users(id),
      provider    text NOT NULL CHECK (provider IN ('GOOGLE', 'APPLE')),
      subject     text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      UNIQUE (provider, subject)
    );

    CREATE TABLE consents (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           uuid NOT NULL REFERENCES users(id),
      document_type     text NOT NULL CHECK (document_type IN ('TERMS', 'PRIVACY')),
      document_version  text NOT NULL,
      accepted_at       timestamptz NOT NULL,
      locale            text NOT NULL,
      app_version       text NULL,
      -- Evidence without storing the raw IP address: HMAC of the client IP.
      ip_hash           text NULL,
      created_at        timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, document_type, document_version)
    );

    CREATE TABLE otp_challenges (
      id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      channel                text NOT NULL CHECK (channel IN ('EMAIL', 'SMS')),
      destination_hash       text NOT NULL,
      destination_encrypted  text NULL,
      destination_masked     text NOT NULL,
      code_hash              text NOT NULL,
      locale                 text NOT NULL DEFAULT 'en',
      attempts               integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      max_attempts           integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
      expires_at             timestamptz NOT NULL,
      consumed_at            timestamptz NULL,
      invalidated_at         timestamptz NULL,
      device_id_hash         text NULL,
      created_at             timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_otp_destination ON otp_challenges (destination_hash, created_at DESC);
    CREATE INDEX ix_otp_expires ON otp_challenges (expires_at) WHERE consumed_at IS NULL;

    CREATE TABLE sessions (
      id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                      uuid NOT NULL REFERENCES users(id),
      device_id_hash               text NOT NULL,
      platform                     text NULL CHECK (platform IS NULL OR platform IN ('ios', 'android')),
      app_version                  text NULL,
      refresh_token_hash           text NOT NULL,
      previous_refresh_token_hash  text NULL,
      rotated_at                   timestamptz NULL,
      expires_at                   timestamptz NOT NULL,
      last_used_at                 timestamptz NOT NULL DEFAULT now(),
      revoked_at                   timestamptz NULL,
      revoked_reason               text NULL CHECK (revoked_reason IS NULL OR revoked_reason IN (
                                     'LOGOUT', 'REFRESH_REUSE', 'ADMIN', 'ACCOUNT_DELETED',
                                     'ACCOUNT_BLOCKED', 'NEW_SIGN_IN_ON_DEVICE', 'PIN_CHANGED')),
      created_at                   timestamptz NOT NULL DEFAULT now(),
      CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
    );
    CREATE UNIQUE INDEX ux_sessions_refresh ON sessions (refresh_token_hash);
    CREATE INDEX ix_sessions_previous_refresh ON sessions (previous_refresh_token_hash)
      WHERE previous_refresh_token_hash IS NOT NULL;
    CREATE INDEX ix_sessions_user_active ON sessions (user_id) WHERE revoked_at IS NULL;
    CREATE INDEX ix_sessions_device ON sessions (device_id_hash, created_at DESC);

    CREATE TABLE device_keys (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES users(id),
      session_id  uuid NOT NULL REFERENCES sessions(id),
      algorithm   text NOT NULL CHECK (algorithm IN ('ED25519', 'ES256')),
      public_key  text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      revoked_at  timestamptz NULL
    );
    CREATE UNIQUE INDEX ux_device_keys_active ON device_keys (session_id) WHERE revoked_at IS NULL;

    CREATE TABLE step_up_challenges (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id   uuid NOT NULL REFERENCES sessions(id),
      purpose      text NOT NULL,
      nonce        text NOT NULL,
      expires_at   timestamptz NOT NULL,
      consumed_at  timestamptz NULL,
      created_at   timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE step_up_grants (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id   uuid NOT NULL REFERENCES sessions(id),
      user_id      uuid NOT NULL REFERENCES users(id),
      token_hash   text NOT NULL UNIQUE,
      purpose      text NOT NULL
                     CHECK (purpose IN ('PAYMENT', 'CHANGE_PIN', 'DELETE_ACCOUNT', 'REGISTER_DEVICE_KEY')),
      method       text NOT NULL CHECK (method IN ('PIN', 'DEVICE_KEY')),
      expires_at   timestamptz NOT NULL,
      consumed_at  timestamptz NULL,
      created_at   timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE admin_users (
      id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email                  citext NOT NULL UNIQUE,
      full_name              text NOT NULL,
      role                   text NOT NULL CHECK (role IN ('VIEWER', 'SUPPORT_AGENT', 'RISK_ANALYST', 'ADMIN')),
      password_hash          text NOT NULL,
      totp_secret_encrypted  text NOT NULL,
      totp_last_used_step    bigint NULL,
      status                 text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
      failed_login_attempts  integer NOT NULL DEFAULT 0,
      locked_until           timestamptz NULL,
      last_login_at          timestamptz NULL,
      created_by             text NULL,
      created_at             timestamptz NOT NULL DEFAULT now(),
      updated_at             timestamptz NOT NULL DEFAULT now()
    );
    CREATE TRIGGER admin_users_touch BEFORE UPDATE ON admin_users
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    -- Password accepted, TOTP pending: short-lived, single-use.
    CREATE TABLE admin_login_challenges (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id     uuid NOT NULL REFERENCES admin_users(id),
      token_hash   text NOT NULL UNIQUE,
      attempts     integer NOT NULL DEFAULT 0,
      expires_at   timestamptz NOT NULL,
      consumed_at  timestamptz NULL,
      created_at   timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE admin_sessions (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id            uuid NOT NULL REFERENCES admin_users(id),
      refresh_token_hash  text NOT NULL UNIQUE,
      expires_at          timestamptz NOT NULL,
      last_used_at        timestamptz NOT NULL DEFAULT now(),
      revoked_at          timestamptz NULL,
      revoked_reason      text NULL,
      created_at          timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_admin_sessions_admin ON admin_sessions (admin_id) WHERE revoked_at IS NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS admin_sessions;
    DROP TABLE IF EXISTS admin_login_challenges;
    DROP TABLE IF EXISTS admin_users;
    DROP TABLE IF EXISTS step_up_grants;
    DROP TABLE IF EXISTS step_up_challenges;
    DROP TABLE IF EXISTS device_keys;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS otp_challenges;
    DROP TABLE IF EXISTS consents;
    DROP TABLE IF EXISTS user_identities;
    DROP TABLE IF EXISTS users;
  `.execute(db);
}
