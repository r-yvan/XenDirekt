import { Kysely, sql } from 'kysely';

/**
 * Payment domain: cards (partner tokens only, never PAN/CVV), payees, quotes, payments with
 * their append-only event timeline, per-call provider operations, adjustments (void / refund /
 * payout reversal), inbound provider events, blocklist and risk flags.
 *
 * Money is bigint minor units with an explicit currency. The financial invariants that must
 * survive concurrency are enforced here, in the database (ADR 0007):
 *   - at most ONE payout operation per payment, ever;
 *   - one authorisation per payment; at most one live capture / void / refund;
 *   - one payment per quote; idempotency keys unique per user.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE blocklist_entries (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type   text NOT NULL CHECK (entity_type IN ('CARD_FINGERPRINT', 'PAYEE', 'DEVICE')),
      entity_value  text NOT NULL,
      reason        text NOT NULL,
      created_by    text NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now(),
      removed_by    text NULL,
      removed_at    timestamptz NULL,
      removal_reason text NULL
    );
    CREATE UNIQUE INDEX ux_blocklist_active ON blocklist_entries (entity_type, entity_value)
      WHERE removed_at IS NULL;

    CREATE TABLE card_setup_sessions (
      id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            uuid NOT NULL REFERENCES users(id),
      provider           text NOT NULL,
      provider_setup_id  text NOT NULL,
      status             text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'COMPLETED', 'FAILED', 'EXPIRED')),
      expires_at         timestamptz NOT NULL,
      completed_at       timestamptz NULL,
      card_id            uuid NULL,
      created_at         timestamptz NOT NULL DEFAULT now(),
      UNIQUE (provider, provider_setup_id)
    );

    CREATE TABLE cards (
      id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                  uuid NOT NULL REFERENCES users(id),
      provider                 text NOT NULL,
      -- AES-256-GCM encrypted partner token; NULL once removed or when rejected.
      provider_token_encrypted text NULL,
      brand                    text NOT NULL CHECK (brand IN ('VISA', 'MASTERCARD', 'OTHER')),
      last4                    char(4) NOT NULL CHECK (last4 ~ '^[0-9]{4}$'),
      expiry_month             smallint NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
      expiry_year              smallint NOT NULL CHECK (expiry_year BETWEEN 2000 AND 2100),
      issuing_country          char(2) NULL,
      funding                  text NOT NULL DEFAULT 'UNKNOWN' CHECK (funding IN ('CREDIT', 'DEBIT', 'PREPAID', 'UNKNOWN')),
      card_currency            char(3) NULL,
      fingerprint              text NULL,
      bin_prefix               text NULL CHECK (bin_prefix IS NULL OR bin_prefix ~ '^[0-9]{6,8}$'),
      is_default               boolean NOT NULL DEFAULT false,
      status                   text NOT NULL CHECK (status IN ('ACTIVE', 'REJECTED', 'REMOVED', 'BLOCKED')),
      rejection_reason         text NULL,
      three_ds_verified_at     timestamptz NULL,
      first_payment_at         timestamptz NULL,
      is_simulated             boolean NOT NULL DEFAULT false,
      removed_at               timestamptz NULL,
      created_at               timestamptz NOT NULL DEFAULT now(),
      updated_at               timestamptz NOT NULL DEFAULT now(),
      CHECK (status <> 'ACTIVE' OR provider_token_encrypted IS NOT NULL)
    );
    CREATE UNIQUE INDEX ux_cards_one_default ON cards (user_id) WHERE is_default AND status = 'ACTIVE';
    CREATE UNIQUE INDEX ux_cards_user_fingerprint_active ON cards (user_id, fingerprint)
      WHERE status = 'ACTIVE' AND fingerprint IS NOT NULL;
    CREATE INDEX ix_cards_user ON cards (user_id, status);
    CREATE INDEX ix_cards_fingerprint ON cards (fingerprint) WHERE fingerprint IS NOT NULL;
    CREATE TRIGGER cards_touch BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    CREATE TABLE payees (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      network           text NOT NULL CHECK (network IN ('MTN')),
      identifier_type   text NOT NULL CHECK (identifier_type IN ('PHONE', 'MERCHANT_CODE')),
      -- E.164 for phones, digits for merchant codes. Needed to pay out; classified as personal data.
      identifier        text NOT NULL,
      registered_name   text NULL,
      lookup_status     text NOT NULL CHECK (lookup_status IN ('VERIFIED', 'NOT_FOUND', 'INACTIVE')),
      last_verified_at  timestamptz NULL,
      is_simulated      boolean NOT NULL DEFAULT false,
      first_paid_at     timestamptz NULL,
      created_at        timestamptz NOT NULL DEFAULT now(),
      updated_at        timestamptz NOT NULL DEFAULT now(),
      UNIQUE (network, identifier_type, identifier)
    );
    CREATE TRIGGER payees_touch BEFORE UPDATE ON payees FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    CREATE TABLE user_payees (
      user_id          uuid NOT NULL REFERENCES users(id),
      payee_id         uuid NOT NULL REFERENCES payees(id),
      last_used_at     timestamptz NOT NULL,
      last_amount_rwf  bigint NULL,
      payment_count    integer NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, payee_id)
    );
    CREATE INDEX ix_user_payees_recent ON user_payees (user_id, last_used_at DESC);

    CREATE TABLE quotes (
      id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                uuid NOT NULL REFERENCES users(id),
      payee_id               uuid NOT NULL REFERENCES payees(id),
      card_id                uuid NOT NULL REFERENCES cards(id),
      amount_rwf             bigint NOT NULL CHECK (amount_rwf > 0),
      fee_rwf                bigint NOT NULL CHECK (fee_rwf >= 0),
      total_rwf              bigint NOT NULL CHECK (total_rwf = amount_rwf + fee_rwf),
      card_currency          char(3) NOT NULL,
      fx_rate                numeric(20, 8) NOT NULL CHECK (fx_rate > 0),
      fx_source              text NOT NULL,
      total_card_minor       bigint NOT NULL CHECK (total_card_minor > 0),
      rounding_mode          text NOT NULL CHECK (rounding_mode IN ('CEILING', 'HALF_UP')),
      fee_config_version     integer NOT NULL,
      limits_config_version  integer NOT NULL,
      fx_config_version      integer NOT NULL,
      config_approved        boolean NOT NULL,
      status                 text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED')),
      is_simulated           boolean NOT NULL DEFAULT false,
      expires_at             timestamptz NOT NULL,
      created_at             timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_quotes_user ON quotes (user_id, created_at DESC);

    CREATE TABLE payments (
      id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reference              text NOT NULL UNIQUE CHECK (reference ~ '^XD-[A-Z2-9]{6}$'),
      user_id                uuid NOT NULL REFERENCES users(id),
      card_id                uuid NOT NULL REFERENCES cards(id),
      payee_id               uuid NOT NULL REFERENCES payees(id),
      quote_id               uuid NOT NULL UNIQUE REFERENCES quotes(id),
      idempotency_key        text NOT NULL,
      request_hash           text NOT NULL,
      -- Keyed hash of the app install that created the payment (risk rules only).
      device_id_hash         text NULL,
      state                  text NOT NULL CHECK (state IN (
                               'QUOTED', 'AUTH_PENDING', 'AUTH_FAILED', 'AUTHORISED', 'PAYOUT_PENDING',
                               'PAYOUT_FAILED', 'VOID_PENDING', 'VOIDED', 'CAPTURE_PENDING', 'CAPTURE_FAILED',
                               'PENDING_REVIEW', 'COMPLETED', 'REFUNDED')),
      review_reason          text NULL,
      failure_code           text NULL,
      amount_rwf             bigint NOT NULL CHECK (amount_rwf > 0),
      fee_rwf                bigint NOT NULL CHECK (fee_rwf >= 0),
      total_rwf              bigint NOT NULL CHECK (total_rwf = amount_rwf + fee_rwf),
      card_currency          char(3) NOT NULL,
      fx_rate                numeric(20, 8) NOT NULL,
      total_card_minor       bigint NOT NULL CHECK (total_card_minor > 0),
      note                   text NULL CHECK (note IS NULL OR length(note) <= 60),
      provider               text NOT NULL,
      is_simulated           boolean NOT NULL,
      three_ds_required      boolean NOT NULL DEFAULT false,
      next_action_url        text NULL,
      payee_name_snapshot    text NOT NULL,
      payee_identifier_masked text NOT NULL,
      card_brand_snapshot    text NOT NULL,
      card_last4_snapshot    char(4) NOT NULL,
      provider_auth_id       text NULL,
      provider_payout_id     text NULL,
      provider_capture_id    text NULL,
      version                integer NOT NULL DEFAULT 0,
      quoted_at              timestamptz NOT NULL,
      auth_pending_at        timestamptz NULL,
      authorised_at          timestamptz NULL,
      payout_pending_at      timestamptz NULL,
      payout_confirmed_at    timestamptz NULL,
      completed_at           timestamptz NULL,
      failed_at              timestamptz NULL,
      voided_at              timestamptz NULL,
      review_at              timestamptz NULL,
      refunded_at            timestamptz NULL,
      state_changed_at       timestamptz NOT NULL,
      created_at             timestamptz NOT NULL DEFAULT now(),
      updated_at             timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, idempotency_key)
    );
    CREATE INDEX ix_payments_user_created ON payments (user_id, created_at DESC);
    CREATE INDEX ix_payments_state ON payments (state, state_changed_at);
    CREATE INDEX ix_payments_card_created ON payments (card_id, created_at DESC);
    CREATE INDEX ix_payments_payee_created ON payments (payee_id, created_at DESC);
    CREATE INDEX ix_payments_provider_payout ON payments (provider_payout_id) WHERE provider_payout_id IS NOT NULL;
    CREATE INDEX ix_payments_provider_auth ON payments (provider_auth_id) WHERE provider_auth_id IS NOT NULL;
    CREATE TRIGGER payments_touch BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    CREATE TABLE payment_events (
      id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id         uuid NOT NULL REFERENCES payments(id),
      from_state         text NULL,
      to_state           text NULL,
      event_type         text NOT NULL,
      source             text NOT NULL CHECK (source IN ('APP', 'PROVIDER', 'OPS', 'WORKER', 'SYSTEM')),
      actor_id           text NULL,
      reason             text NULL,
      payload_redacted   jsonb NULL,
      correlation_id     text NULL,
      created_at         timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_payment_events_payment ON payment_events (payment_id, created_at);
    CREATE TRIGGER payment_events_append_only BEFORE UPDATE OR DELETE ON payment_events
      FOR EACH ROW EXECUTE FUNCTION forbid_modification();

    CREATE TABLE provider_operations (
      id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id             uuid NOT NULL REFERENCES payments(id),
      type                   text NOT NULL CHECK (type IN ('AUTHORISATION', 'PAYOUT', 'CAPTURE', 'VOID', 'REFUND')),
      -- Our stable reference sent to the provider (customerReference); unique forever.
      request_ref            text NOT NULL UNIQUE,
      provider_ref           text NULL,
      status                 text NOT NULL CHECK (status IN ('REQUESTED', 'PENDING', 'SUCCEEDED', 'FAILED', 'UNKNOWN', 'REVERSED')),
      amount_minor           bigint NOT NULL CHECK (amount_minor > 0),
      currency               char(3) NOT NULL,
      provider_status_raw    text NULL,
      failure_code           text NULL,
      response_redacted      jsonb NULL,
      requested_at           timestamptz NOT NULL,
      completed_at           timestamptz NULL,
      last_checked_at        timestamptz NULL,
      check_count            integer NOT NULL DEFAULT 0,
      created_at             timestamptz NOT NULL DEFAULT now(),
      updated_at             timestamptz NOT NULL DEFAULT now()
    );
    -- Money invariants (ADR 0007).
    CREATE UNIQUE INDEX ux_operations_single_payout ON provider_operations (payment_id) WHERE type = 'PAYOUT';
    CREATE UNIQUE INDEX ux_operations_single_authorisation ON provider_operations (payment_id) WHERE type = 'AUTHORISATION';
    CREATE UNIQUE INDEX ux_operations_live_capture ON provider_operations (payment_id) WHERE type = 'CAPTURE' AND status <> 'FAILED';
    CREATE UNIQUE INDEX ux_operations_live_void ON provider_operations (payment_id) WHERE type = 'VOID' AND status <> 'FAILED';
    CREATE UNIQUE INDEX ux_operations_live_refund ON provider_operations (payment_id) WHERE type = 'REFUND' AND status <> 'FAILED';
    CREATE INDEX ix_operations_provider_ref ON provider_operations (provider_ref) WHERE provider_ref IS NOT NULL;
    CREATE INDEX ix_operations_status ON provider_operations (status, type);
    CREATE TRIGGER provider_operations_touch BEFORE UPDATE ON provider_operations
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    CREATE TABLE payment_adjustments (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reference           text NOT NULL UNIQUE,
      payment_id          uuid NOT NULL REFERENCES payments(id),
      type                text NOT NULL CHECK (type IN ('VOID', 'REFUND', 'PAYOUT_REVERSAL')),
      status              text NOT NULL CHECK (status IN (
                            'REQUESTED', 'APPROVED', 'SUBMITTED', 'SUCCEEDED', 'FAILED', 'REJECTED',
                            'AWAITING_CAPABILITY', 'RECORDED')),
      amount_minor        bigint NOT NULL CHECK (amount_minor > 0),
      currency            char(3) NOT NULL,
      reason              text NOT NULL,
      requested_by_type   text NOT NULL CHECK (requested_by_type IN ('ADMIN', 'SYSTEM', 'PROVIDER')),
      requested_by        text NULL,
      approved_by         text NULL,
      approved_at         timestamptz NULL,
      operation_id        uuid NULL REFERENCES provider_operations(id),
      provider_ref        text NULL,
      idempotency_key     text NULL UNIQUE,
      response_redacted   jsonb NULL,
      created_at          timestamptz NOT NULL DEFAULT now(),
      updated_at          timestamptz NOT NULL DEFAULT now(),
      completed_at        timestamptz NULL,
      CHECK (approved_by IS NULL OR requested_by IS NULL OR approved_by <> requested_by)
    );
    -- No duplicate live refund for a payment.
    CREATE UNIQUE INDEX ux_adjustments_live_refund ON payment_adjustments (payment_id)
      WHERE type = 'REFUND' AND status NOT IN ('FAILED', 'REJECTED');
    CREATE INDEX ix_adjustments_payment ON payment_adjustments (payment_id, created_at);
    CREATE TRIGGER payment_adjustments_touch BEFORE UPDATE ON payment_adjustments
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    CREATE TABLE inbound_provider_events (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider            text NOT NULL,
      external_event_id   text NOT NULL,
      event_type          text NOT NULL,
      signature_valid     boolean NOT NULL,
      payload_redacted    jsonb NULL,
      received_at         timestamptz NOT NULL DEFAULT now(),
      processed_at        timestamptz NULL,
      outcome             text NULL,
      UNIQUE (provider, external_event_id)
    );

    CREATE TABLE risk_flags (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id    uuid NULL REFERENCES payments(id),
      user_id       uuid NULL REFERENCES users(id),
      card_id       uuid NULL REFERENCES cards(id),
      payee_id      uuid NULL REFERENCES payees(id),
      rule          text NOT NULL,
      severity      text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
      action        text NOT NULL CHECK (action IN ('FLAG', 'HOLD', 'BLOCK')),
      evidence      jsonb NOT NULL DEFAULT '{}'::jsonb,
      status        text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CONFIRMED_FRAUD', 'DISMISSED')),
      reviewer_id   text NULL,
      reviewed_at   timestamptz NULL,
      review_note   text NULL,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_risk_flags_open ON risk_flags (status, created_at DESC);
    CREATE INDEX ix_risk_flags_payment ON risk_flags (payment_id) WHERE payment_id IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS risk_flags;
    DROP TABLE IF EXISTS inbound_provider_events;
    DROP TABLE IF EXISTS payment_adjustments;
    DROP TABLE IF EXISTS provider_operations;
    DROP TABLE IF EXISTS payment_events;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS quotes;
    DROP TABLE IF EXISTS user_payees;
    DROP TABLE IF EXISTS payees;
    DROP TABLE IF EXISTS cards;
    DROP TABLE IF EXISTS card_setup_sessions;
    DROP TABLE IF EXISTS blocklist_entries;
  `.execute(db);
}
