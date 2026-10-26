import { Kysely, sql } from 'kysely';

/**
 * Foundation: append-only audit log, transactional outbox, versioned business configuration.
 * Every table uses UUID keys and UTC timestamps (timestamptz).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE EXTENSION IF NOT EXISTS citext;

    CREATE FUNCTION forbid_modification() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
    END
    $$;

    CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END
    $$;

    CREATE TABLE audit_logs (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_type      text NOT NULL CHECK (actor_type IN ('USER', 'ADMIN', 'SYSTEM', 'WORKER', 'PROVIDER')),
      actor_id        text NULL,
      action          text NOT NULL,
      entity_type     text NOT NULL,
      entity_id       text NULL,
      before          jsonb NULL,
      after           jsonb NULL,
      metadata        jsonb NULL,
      correlation_id  text NULL,
      created_at      timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC);
    CREATE INDEX ix_audit_logs_actor ON audit_logs (actor_type, actor_id, created_at DESC);
    CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at DESC);
    CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION forbid_modification();
    CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
      FOR EACH STATEMENT EXECUTE FUNCTION forbid_modification();

    CREATE TABLE outbox_events (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type            text NOT NULL,
      aggregate_type  text NOT NULL,
      aggregate_id    text NOT NULL,
      payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
      status          text NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'DEAD')),
      attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      max_attempts    integer NOT NULL DEFAULT 10 CHECK (max_attempts > 0),
      available_at    timestamptz NOT NULL DEFAULT now(),
      locked_until    timestamptz NULL,
      locked_by       text NULL,
      last_error      text NULL,
      dedupe_key      text NULL,
      correlation_id  text NULL,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now(),
      processed_at    timestamptz NULL
    );
    -- At most one live job per dedupe key (for example one status poll per payment).
    CREATE UNIQUE INDEX ux_outbox_live_dedupe ON outbox_events (dedupe_key)
      WHERE dedupe_key IS NOT NULL AND status IN ('PENDING', 'PROCESSING');
    CREATE INDEX ix_outbox_due ON outbox_events (available_at) WHERE status = 'PENDING';
    CREATE INDEX ix_outbox_lease ON outbox_events (locked_until) WHERE status = 'PROCESSING';
    CREATE INDEX ix_outbox_aggregate ON outbox_events (aggregate_type, aggregate_id, created_at DESC);
    CREATE INDEX ix_outbox_dead ON outbox_events (updated_at DESC) WHERE status = 'DEAD';
    CREATE TRIGGER outbox_events_touch BEFORE UPDATE ON outbox_events
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    CREATE TABLE configuration_versions (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      config_key          text NOT NULL
                            CHECK (config_key IN ('FEES', 'LIMITS', 'FX_RATES', 'CARD_RULES', 'PAYEE_ROUTING')),
      version             integer NOT NULL CHECK (version > 0),
      value               jsonb NOT NULL,
      status              text NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'REJECTED')),
      -- false = placeholder or unapproved values; production refuses to price with them.
      approved            boolean NOT NULL DEFAULT false,
      approval_reference  text NULL,
      change_reason       text NOT NULL,
      created_by          text NOT NULL,
      created_at          timestamptz NOT NULL DEFAULT now(),
      activated_by        text NULL,
      activated_at        timestamptz NULL,
      UNIQUE (config_key, version),
      CHECK (NOT approved OR approval_reference IS NOT NULL)
    );
    CREATE UNIQUE INDEX ux_configuration_one_active ON configuration_versions (config_key)
      WHERE status = 'ACTIVE';
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS configuration_versions;
    DROP TABLE IF EXISTS outbox_events;
    DROP TABLE IF EXISTS audit_logs;
    DROP FUNCTION IF EXISTS touch_updated_at();
    DROP FUNCTION IF EXISTS forbid_modification();
  `.execute(db);
}
