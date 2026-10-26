import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type ActorType = 'USER' | 'ADMIN' | 'SYSTEM' | 'WORKER' | 'PROVIDER';

export interface Actor {
  type: ActorType;
  id?: string;
}

export interface RequestContextData {
  correlationId: string;
  actor?: Actor;
}

const storage = new AsyncLocalStorage<RequestContextData>();

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,64}$/;

/**
 * Correlation IDs tie an HTTP request to everything it causes: audit rows, payment events,
 * outbox jobs and worker logs. A client-supplied X-Request-Id is accepted only if well formed.
 */
export const RequestContext = {
  run<T>(data: RequestContextData, fn: () => T): T {
    return storage.run(data, fn);
  },

  get(): RequestContextData | undefined {
    return storage.getStore();
  },

  correlationId(): string | undefined {
    return storage.getStore()?.correlationId;
  },

  setActor(actor: Actor): void {
    const store = storage.getStore();
    if (store) {
      store.actor = actor;
    }
  },

  actor(): Actor | undefined {
    return storage.getStore()?.actor;
  },

  normaliseIncomingId(candidate: unknown): string {
    if (typeof candidate === 'string' && CORRELATION_ID_PATTERN.test(candidate)) {
      return candidate;
    }
    return randomUUID();
  },
};
