import { Kysely, PostgresDialect, Transaction } from 'kysely';
import pg from 'pg';
import type { DB } from './schema';

/** Either the root connection or an open transaction; repositories accept both. */
export type Executor = Kysely<DB> | Transaction<DB>;

let typeParsersInstalled = false;

/**
 * int8 → bigint so money never passes through a float; DATE stays 'YYYY-MM-DD' text so a
 * date of birth is never shifted by a server timezone. numeric stays text (FX rates are parsed
 * into scaled integers by the money module).
 */
export function installTypeParsers(): void {
  if (typeParsersInstalled) {
    return;
  }
  pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => BigInt(value));
  pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);
  typeParsersInstalled = true;
}

export interface DatabaseOptions {
  url: string;
  poolMax: number;
  ssl: boolean;
  applicationName?: string;
}

export function createDatabase(options: DatabaseOptions): Kysely<DB> {
  installTypeParsers();
  const pool = new pg.Pool({
    connectionString: options.url,
    max: options.poolMax,
    ssl: options.ssl ? { rejectUnauthorized: true } : undefined,
    application_name: options.applicationName ?? 'xendirekt-api',
    // Guard rails: no statement or open transaction may stall the pool.
    // Remote provider calls are never made while a transaction is open.
    statement_timeout: 15_000,
    idle_in_transaction_session_timeout: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

/** JSON text for jsonb columns; bigint values become strings. */
export function toJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
}
