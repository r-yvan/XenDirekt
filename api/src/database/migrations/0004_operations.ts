import { Kysely, sql } from 'kysely';

/**
 * Operations: notifications (in-app inbox + delivery log for push/SMS/email), push tokens,
 * support tickets, daily reconciliation runs and items, and PII-free analytics events.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE notifications (
      id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                uuid NULL REFERENCES users(id),
      payment_id             uuid NULL REFERENCES payments(id),
      audience               text NOT NULL CHECK (audience IN ('TOURIST', 'MERCHANT')),
      channel                text NOT NULL CHECK (channel IN ('IN_APP', 'PUSH', 'SMS', 'EMAIL')),
      template               text NOT NULL,
      locale                 text NOT NULL DEFAULT 'en',
      -- In-app copy only; SMS/email text is rendered at send time and never stored.
      title                  text NULL,
      body                   text NULL,
      deep_link              text NULL,
      dedupe_key             text NOT NULL UNIQUE,
      status                 text NOT NULL DEFAULT 'PENDING'
                               CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SUPPRESSED')),
      status_reason          text NULL,
      attempts               integer NOT NULL DEFAULT 0,
      provider_message_id    text NULL,
      read_at                timestamptz NULL,
      sent_at                timestamptz NULL,
      created_at             timestamptz NOT NULL DEFAULT now(),
      updated_at             timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_notifications_inbox ON notifications (user_id, created_at DESC) WHERE channel = 'IN_APP';
    CREATE INDEX ix_notifications_status ON notifications (status, created_at);
    CREATE TRIGGER notifications_touch BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    CREATE TABLE push_tokens (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          uuid NOT NULL REFERENCES users(id),
      session_id       uuid NOT NULL REFERENCES sessions(id),
      platform         text NOT NULL CHECK (platform IN ('ios', 'android')),
      token_encrypted  text NOT NULL,
      token_hash       text NOT NULL,
      created_at       timestamptz NOT NULL DEFAULT now(),
      revoked_at       timestamptz NULL
    );
    CREATE UNIQUE INDEX ux_push_tokens_active ON push_tokens (token_hash) WHERE revoked_at IS NULL;
    CREATE INDEX ix_push_tokens_user ON push_tokens (user_id) WHERE revoked_at IS NULL;

    CREATE TABLE tickets (
      id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reference               text NOT NULL UNIQUE CHECK (reference ~ '^TK-[A-Z2-9]{6}$'),
      user_id                 uuid NOT NULL REFERENCES users(id),
      payment_id              uuid NULL REFERENCES payments(id),
      category                text NOT NULL CHECK (category IN (
                                'SELLER_NOT_PAID', 'WRONG_AMOUNT', 'CHARGED_BUT_FAILED', 'CHARGED_TWICE',
                                'WRONG_SELLER', 'REFUND_REQUEST', 'APP_PROBLEM', 'OTHER')),
      message                 text NULL CHECK (message IS NULL OR length(message) <= 1000),
      payment_state_snapshot  text NULL,
      status                  text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
      assignee_id             uuid NULL REFERENCES admin_users(id),
      resolution_note         text NULL,
      created_at              timestamptz NOT NULL DEFAULT now(),
      updated_at              timestamptz NOT NULL DEFAULT now(),
      resolved_at             timestamptz NULL
    );
    CREATE INDEX ix_tickets_user ON tickets (user_id, created_at DESC);
    CREATE INDEX ix_tickets_queue ON tickets (status, created_at);
    CREATE INDEX ix_tickets_payment ON tickets (payment_id) WHERE payment_id IS NOT NULL;
    CREATE TRIGGER tickets_touch BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    CREATE TABLE reconciliation_runs (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      business_date    date NOT NULL,
      provider         text NOT NULL,
      source           text NOT NULL CHECK (source IN ('STATUS_API', 'SETTLEMENT_FILE')),
      file_name        text NULL,
      file_sha256      text NULL,
      status           text NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
      totals           jsonb NOT NULL DEFAULT '{}'::jsonb,
      error            text NULL,
      triggered_by     text NOT NULL,
      started_at       timestamptz NOT NULL DEFAULT now(),
      completed_at     timestamptz NULL
    );
    CREATE INDEX ix_reconciliation_runs_date ON reconciliation_runs (business_date DESC, started_at DESC);

    CREATE TABLE reconciliation_items (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id              uuid NOT NULL REFERENCES reconciliation_runs(id),
      payment_id          uuid NULL REFERENCES payments(id),
      operation_type      text NULL,
      internal_reference  text NULL,
      provider_reference  text NULL,
      match_state         text NOT NULL CHECK (match_state IN (
                            'MATCHED', 'MISSING_AT_PROVIDER', 'MISSING_INTERNAL', 'AMOUNT_MISMATCH',
                            'STATUS_MISMATCH', 'CURRENCY_MISMATCH', 'REVERSAL')),
      internal_amount     bigint NULL,
      provider_amount     bigint NULL,
      currency            char(3) NULL,
      internal_status     text NULL,
      provider_status     text NULL,
      details             jsonb NOT NULL DEFAULT '{}'::jsonb,
      resolution_status   text NOT NULL DEFAULT 'UNRESOLVED' CHECK (resolution_status IN ('UNRESOLVED', 'RESOLVED', 'NOT_APPLICABLE')),
      resolved_by         uuid NULL REFERENCES admin_users(id),
      resolved_at         timestamptz NULL,
      resolution_note     text NULL,
      created_at          timestamptz NOT NULL DEFAULT now(),
      CHECK (resolution_status = 'UNRESOLVED' OR (resolved_by IS NOT NULL AND resolution_note IS NOT NULL) OR match_state = 'MATCHED')
    );
    CREATE INDEX ix_reconciliation_items_run ON reconciliation_items (run_id, match_state);
    CREATE INDEX ix_reconciliation_items_open ON reconciliation_items (resolution_status) WHERE resolution_status = 'UNRESOLVED';

    CREATE TABLE analytics_events (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_name    text NOT NULL,
      user_id       uuid NULL,
      properties    jsonb NOT NULL DEFAULT '{}'::jsonb,
      occurred_at   timestamptz NOT NULL,
      received_at   timestamptz NOT NULL DEFAULT now(),
      source        text NOT NULL CHECK (source IN ('APP', 'SERVER'))
    );
    CREATE INDEX ix_analytics_events_name ON analytics_events (event_name, occurred_at DESC);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS analytics_events;
    DROP TABLE IF EXISTS reconciliation_items;
    DROP TABLE IF EXISTS reconciliation_runs;
    DROP TABLE IF EXISTS tickets;
    DROP TABLE IF EXISTS push_tokens;
    DROP TABLE IF EXISTS notifications;
  `.execute(db);
}
