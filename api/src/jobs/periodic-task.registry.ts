import { Injectable, Logger } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { InjectDatabase } from '../database/database.module';
import type { DB } from '../database/schema';

export interface PeriodicTask {
  name: string;
  intervalMs: number;
  /** Unique 32-bit key for pg_try_advisory_lock so only one instance runs the task at a time. */
  lockKey: number;
  run(): Promise<void>;
}

/**
 * Periodic jobs (stale-payment sweeper, reconciliation, metrics collection). Each run takes a
 * session-level advisory lock on a dedicated connection; instances that cannot get the lock skip.
 */
@Injectable()
export class PeriodicTaskRegistry {
  private readonly logger = new Logger(PeriodicTaskRegistry.name);
  private readonly tasks = new Map<string, PeriodicTask>();

  constructor(@InjectDatabase() private readonly db: Kysely<DB>) {}

  register(task: PeriodicTask): void {
    if (this.tasks.has(task.name)) {
      throw new Error(`Duplicate periodic task "${task.name}"`);
    }
    this.tasks.set(task.name, task);
  }

  list(): PeriodicTask[] {
    return [...this.tasks.values()];
  }

  /** Runs the task once if no other instance holds its lock. Returns false when skipped. */
  async runExclusive(task: PeriodicTask): Promise<boolean> {
    return this.db.connection().execute(async (connection) => {
      const locked = await sql<{
        locked: boolean;
      }>`SELECT pg_try_advisory_lock(${task.lockKey}) AS locked`.execute(connection);
      if (!locked.rows[0]?.locked) {
        return false;
      }
      try {
        await task.run();
        return true;
      } catch (error) {
        this.logger.error({ task: task.name, err: error }, 'Periodic task failed');
        return true;
      } finally {
        await sql`SELECT pg_advisory_unlock(${task.lockKey})`.execute(connection);
      }
    });
  }
}
