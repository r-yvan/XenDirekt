import { Kysely } from 'kysely';
import { loadLocalEnvFile } from '../../config/load-env-file';
import { createDatabase } from '../database.factory';
import { migrateDown, migrateToLatest } from '../migrator';

/**
 * Usage: npm run db:migrate (latest) | npm run db:migrate:down (one step back).
 * Reads DATABASE_URL and DATABASE_SSL only, so it can run in a release job without app secrets.
 */
async function main(): Promise<void> {
  loadLocalEnvFile();
  const direction = process.argv[2] ?? 'latest';
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  const db = createDatabase({
    url,
    poolMax: 2,
    ssl: process.env.DATABASE_SSL === 'require',
    applicationName: 'xendirekt-migrate',
  }) as unknown as Kysely<unknown>;
  try {
    const results = direction === 'down' ? await migrateDown(db) : await migrateToLatest(db);
    console.log(results.length > 0 ? results.join('\n') : 'No migrations to run.');
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
