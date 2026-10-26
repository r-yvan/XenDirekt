import { Injectable } from '@nestjs/common';
import { OutboxHandler } from './outbox.types';

/** Feature modules register their job handlers here during onModuleInit. */
@Injectable()
export class OutboxHandlerRegistry {
  private readonly handlers = new Map<string, OutboxHandler>();

  register(handler: OutboxHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`Duplicate outbox handler for type "${handler.type}"`);
    }
    this.handlers.set(handler.type, handler);
  }

  get(type: string): OutboxHandler | undefined {
    return this.handlers.get(type);
  }

  types(): string[] {
    return [...this.handlers.keys()];
  }
}
