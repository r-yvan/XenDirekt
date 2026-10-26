import { Injectable } from '@nestjs/common';
import { Executor } from '../../database/database.factory';

/**
 * Modules that hold user data register a hook here (for example, cards removes partner tokens).
 * Hooks run inside the deletion transaction.
 */
export type AccountDeletionHook = (executor: Executor, userId: string) => Promise<void>;

@Injectable()
export class AccountDeletionHooks {
  private readonly hooks: { name: string; run: AccountDeletionHook }[] = [];

  register(name: string, run: AccountDeletionHook): void {
    this.hooks.push({ name, run });
  }

  async runAll(executor: Executor, userId: string): Promise<void> {
    for (const hook of this.hooks) {
      await hook.run(executor, userId);
    }
  }
}
