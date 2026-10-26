import type { Migration } from 'kysely/migration';
import * as m0001 from './0001_foundation';
import * as m0002 from './0002_identity';
import * as m0003 from './0003_payments';

/**
 * Ordered, explicit migration registry. Names are permanent once deployed: never rename or
 * edit a shipped migration; add a new one instead.
 */
export const migrations: Record<string, Migration> = {
  '0001_foundation': m0001,
  '0002_identity': m0002,
  '0003_payments': m0003,
};
