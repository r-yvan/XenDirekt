import { Kysely, sql } from 'kysely';
import type { DB } from '../../src/database/schema';
import { openTestDatabase } from '../support/test-database';
import { EXPECTED_COLUMNS } from '../support/expected-columns';

/**
 * Guards against drift between the hand-written Kysely types (src/database/schema.ts) and the
 * migrations. EXPECTED_COLUMNS is derived from the DB interface keys at compile time, so a column
 * added in one place but not the other fails here.
 */
describe('schema drift', () => {
  let db: Kysely<DB>;

  beforeAll(() => {
    db = openTestDatabase();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('every typed table and column exists in the migrated database, and vice versa', async () => {
    const result = await sql<{ table_name: string; column_name: string }>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name NOT LIKE 'kysely_%'
    `.execute(db);

    const actual = new Map<string, Set<string>>();
    for (const row of result.rows) {
      const columns = actual.get(row.table_name) ?? new Set<string>();
      columns.add(row.column_name);
      actual.set(row.table_name, columns);
    }

    expect([...actual.keys()].sort()).toEqual(Object.keys(EXPECTED_COLUMNS).sort());
    for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
      expect({ table, columns: [...(actual.get(table) ?? [])].sort() }).toEqual({
        table,
        columns: [...columns].sort(),
      });
    }
  });
});
