import type { Selectable } from 'kysely';
import type { OutboxEventsTable } from '../../database/schema';

export type OutboxEvent = Selectable<OutboxEventsTable>;

export interface EnqueueOptions {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
  /** Defaults to now. */
  availableAt?: Date;
  /** At most one live (pending or processing) job per key; duplicates are dropped silently. */
  dedupeKey?: string;
  maxAttempts?: number;
}

/**
 * What a handler tells the dispatcher:
 * - done: finished, never run again.
 * - reschedule: not a failure; run the same job again later (polling). Attempts reset.
 * Throwing means failure: retried with backoff, or dead after max attempts.
 */
export type HandlerResult =
  | { outcome: 'done' }
  | { outcome: 'reschedule'; delayMs: number; payload?: Record<string, unknown> };

export const DONE: HandlerResult = { outcome: 'done' };

export interface OutboxHandler {
  readonly type: string;
  handle(event: OutboxEvent): Promise<HandlerResult>;
}

/** Throw to send a job straight to DEAD (retrying cannot help, for example invalid payload). */
export class NonRetryableJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableJobError';
  }
}
