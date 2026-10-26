import { Kysely, sql } from 'kysely';
import { migrateToLatest } from '../../src/database/migrator';
import { ensureTestDatabaseExists, openTestDatabase, TEST_DATABASE_URL } from './test-database';

/** Runs once per Jest invocation: recreate the schema and apply every migration. */
export default async function globalSetup(): Promise<void> {
  await ensureTestDatabaseExists(TEST_DATABASE_URL);
  const db = openTestDatabase();
  try {
    await sql`DROP SCHEMA IF EXISTS public CASCADE`.execute(db);
    await sql`CREATE SCHEMA public`.execute(db);
    await migrateToLatest(db as unknown as Kysely<unknown>);
  } finally {
    await db.destroy();
  }
}
