import { Kysely, sql } from 'kysely';

/**
 * The web portal and the pre-launch website:
 * - sessions may come from the web portal (platform 'web');
 * - payments remember where 3-D Secure returns to: the app deep link or the web portal;
 * - the public waitlist (with referral codes), anonymous Hustle Check answers, and moderated
 *   "Wall of Hustle" stories.
 * The launch tables store no IP addresses or device identifiers: abuse is controlled by rate
 * limits, and Hustle Check answers are never linked to a person.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE sessions DROP CONSTRAINT sessions_platform_check;
    ALTER TABLE sessions ADD CONSTRAINT sessions_platform_check
      CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web'));

    ALTER TABLE payments ADD COLUMN return_channel text NOT NULL DEFAULT 'APP'
      CHECK (return_channel IN ('APP', 'WEB'));

    CREATE TABLE waitlist_entries (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      -- Join order; the public position is derived from it and from referrals.
      seq              bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
      email            citext NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
      full_name        text NULL CHECK (full_name IS NULL OR length(full_name) BETWEEN 1 AND 80),
      persona          text NULL CHECK (persona IS NULL OR persona IN ('VISITOR', 'SENDER', 'DIASPORA', 'RECEIVER')),
      country_code     char(2) NULL CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
      locale           text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'fr')),
      referral_code    text NOT NULL UNIQUE CHECK (referral_code ~ '^[A-HJKMNP-Z2-9]{8}$'),
      referred_by      uuid NULL REFERENCES waitlist_entries(id) ON DELETE SET NULL,
      source           text NULL CHECK (source IS NULL OR source ~ '^[A-Za-z0-9_.-]{1,40}$'),
      -- Version of the privacy notice the person accepted when joining.
      privacy_version  text NOT NULL,
      welcome_sent_at  timestamptz NULL,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now(),
      CHECK (referred_by IS NULL OR referred_by <> id)
    );
    CREATE INDEX ix_waitlist_referred_by ON waitlist_entries (referred_by) WHERE referred_by IS NOT NULL;
    CREATE INDEX ix_waitlist_created_at ON waitlist_entries (created_at DESC);
    CREATE TRIGGER waitlist_entries_touch BEFORE UPDATE ON waitlist_entries
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    -- Anonymous survey answers: codes only, no free text, never linked to a person.
    CREATE TABLE hustle_check_responses (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      persona     text NOT NULL CHECK (persona IN ('VISITOR', 'SENDER', 'DIASPORA', 'RECEIVER')),
      last_time   text NOT NULL CHECK (last_time IN ('SMOOTH', 'DETOUR', 'DECLINED', 'STUCK')),
      speed       text NOT NULL CHECK (speed IN ('SECONDS', 'SAME_DAY', 'DAYS', 'UNKNOWN')),
      fees        text NOT NULL CHECK (fees IN ('LOW', 'SOME', 'LOTS', 'UNKNOWN')),
      checking    text NOT NULL CHECK (checking IN ('NEVER', 'SOMETIMES', 'OFTEN', 'ALWAYS')),
      score       integer NOT NULL CHECK (score BETWEEN 0 AND 100),
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_hustle_check_score ON hustle_check_responses (score);

    -- Visitor stories: shown publicly only after a person approves them.
    CREATE TABLE wall_stories (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      body             text NOT NULL CHECK (length(body) BETWEEN 20 AND 600),
      country_code     char(2) NULL CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
      persona          text NULL CHECK (persona IS NULL OR persona IN ('VISITOR', 'SENDER', 'DIASPORA', 'RECEIVER')),
      status           text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
      moderated_by     uuid NULL REFERENCES admin_users(id),
      moderated_at     timestamptz NULL,
      moderation_note  text NULL CHECK (moderation_note IS NULL OR length(moderation_note) <= 500),
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now(),
      CHECK (status = 'PENDING' OR (moderated_by IS NOT NULL AND moderated_at IS NOT NULL))
    );
    CREATE INDEX ix_wall_stories_status ON wall_stories (status, created_at DESC);
    CREATE TRIGGER wall_stories_touch BEFORE UPDATE ON wall_stories
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS wall_stories;
    DROP TABLE IF EXISTS hustle_check_responses;
    DROP TABLE IF EXISTS waitlist_entries;
    ALTER TABLE payments DROP COLUMN IF EXISTS return_channel;
    UPDATE sessions SET platform = NULL WHERE platform = 'web';
    ALTER TABLE sessions DROP CONSTRAINT sessions_platform_check;
    ALTER TABLE sessions ADD CONSTRAINT sessions_platform_check
      CHECK (platform IS NULL OR platform IN ('ios', 'android'));
  `.execute(db);
}
