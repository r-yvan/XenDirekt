import type { Kysely } from 'kysely';
import { MigrationResultSet, Migrator } from 'kysely/migration';
import { migrations } from './migrations';

function createMigrator(db: Kysely<unknown>): Migrator {
  return new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  });
}

function unwrap(resultSet: MigrationResultSet): string[] {
  if (resultSet.error) {
    const failed = resultSet.results?.find((result) => result.status === 'Error');
    const name = failed ? ` (${failed.migrationName})` : '';
    const reason =
      resultSet.error instanceof Error ? resultSet.error.message : JSON.stringify(resultSet.error);
    throw new Error(`Migration failed${name}: ${reason}`);
  }
  return (resultSet.results ?? []).map((result) => `${result.status}: ${result.migrationName}`);
}

export async function migrateToLatest(db: Kysely<unknown>): Promise<string[]> {
  return unwrap(await createMigrator(db).migrateToLatest());
}

export async function migrateDown(db: Kysely<unknown>): Promise<string[]> {
  return unwrap(await createMigrator(db).migrateDown());
}

/** Readiness check: true when every registered migration has been applied. */
export async function hasPendingMigrations(db: Kysely<unknown>): Promise<boolean> {
  const info = await createMigrator(db).getMigrations();
  return info.some((migration) => migration.executedAt === undefined);
}
