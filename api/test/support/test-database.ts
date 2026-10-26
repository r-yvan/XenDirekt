import { Kysely, sql } from 'kysely';
import pg from 'pg';
import { createDatabase } from '../../src/database/database.factory';
import type { DB } from '../../src/database/schema';

/**
 * Integration and e2e tests use a real PostgreSQL database. TEST_DATABASE_URL defaults to a
 * local socket connection. As a safety rail the database name MUST end in "_test", because
 * the harness drops and recreates its schema.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql:///xendirekt_test?host=/var/run/postgresql';

export function assertTestDatabase(url: string): string {
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to use database "${name}" for tests: the name must end in "_test".`);
  }
  return name;
}

/** Creates the test database on the same server if it does not exist yet. */
export async function ensureTestDatabaseExists(url: string): Promise<void> {
  const name = assertTestDatabase(url);
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount === 0) {
      const quoted = `"${name.replace(/"/g, '')}"`;
      try {
        // PostgreSQL 17+: glibc-independent collation, immune to OS collation-version drift.
        await client.query(
          `CREATE DATABASE ${quoted} TEMPLATE template0 LOCALE_PROVIDER builtin BUILTIN_LOCALE 'C.UTF-8' ENCODING 'UTF8'`,
        );
      } catch {
        await client.query(`CREATE DATABASE ${quoted} TEMPLATE template0 ENCODING 'UTF8'`);
      }
    }
  } finally {
    await client.end();
  }
}

export function openTestDatabase(): Kysely<DB> {
  assertTestDatabase(TEST_DATABASE_URL);
  return createDatabase({
    url: TEST_DATABASE_URL,
    poolMax: 5,
    ssl: false,
    applicationName: 'xendirekt-tests',
  });
}

const PRESERVED_TABLES = new Set(['kysely_migration', 'kysely_migration_lock']);

/**
 * Empties every application table between tests. Triggers are bypassed for the duration
 * (session_replication_role = replica) so append-only tables can be cleared in tests only.
 */
export async function resetDatabase(db: Kysely<DB>): Promise<void> {
  const tables = await sql<{ tablename: string }>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `.execute(db);
  const names = tables.rows
    .map((row) => row.tablename)
    .filter((name) => !PRESERVED_TABLES.has(name));
  if (names.length === 0) {
    return;
  }
  const list = names.map((name) => `"${name}"`).join(', ');
  await db.connection().execute(async (connection) => {
    await sql`SET session_replication_role = replica`.execute(connection);
    try {
      await sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`).execute(connection);
    } finally {
      await sql`SET session_replication_role = DEFAULT`.execute(connection);
    }
  });
}
