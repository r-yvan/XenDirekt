import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { OutboxDispatcher } from './outbox/outbox.dispatcher';
import { PeriodicTaskRegistry } from './periodic-task.registry';

export type ProcessRole = 'api' | 'worker';
export const PROCESS_ROLE = Symbol('PROCESS_ROLE');

/**
 * Starts background loops when this process should run them:
 * - worker process: always (unless WORKER_MODE=disabled);
 * - API process: only with WORKER_MODE=inline (local/test convenience).
 * Loops stop cleanly on shutdown and never overlap themselves.
 */
@Injectable()
export class WorkerRuntime implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerRuntime.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private stopping = false;
  private dispatching = false;
  private readonly runningTasks = new Set<string>();

  static readonly POLL_INTERVAL_MS = 500;

  constructor(
    private readonly config: AppConfig,
    private readonly dispatcher: OutboxDispatcher,
    private readonly periodicTasks: PeriodicTaskRegistry,
    @Inject(PROCESS_ROLE) private readonly role: ProcessRole,
  ) {}

  get shouldRun(): boolean {
    if (this.config.workerMode === 'disabled') {
      return false;
    }
    return this.role === 'worker' || this.config.workerMode === 'inline';
  }

  onApplicationBootstrap(): void {
    if (!this.shouldRun) {
      return;
    }
    this.logger.log(
      { role: this.role, mode: this.config.workerMode },
      'Starting background workers',
    );
    this.timers.push(setInterval(() => void this.dispatchTick(), WorkerRuntime.POLL_INTERVAL_MS));
    for (const task of this.periodicTasks.list()) {
      this.timers.push(setInterval(() => void this.taskTick(task.name), task.intervalMs));
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    // Let an in-flight batch finish so leases are released promptly.
    const deadline = Date.now() + 10_000;
    while ((this.dispatching || this.runningTasks.size > 0) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async dispatchTick(): Promise<void> {
    if (this.stopping || this.dispatching) {
      return;
    }
    this.dispatching = true;
    try {
      await this.dispatcher.runOnce();
    } catch (error) {
      this.logger.error({ err: error }, 'Outbox dispatch tick failed');
    } finally {
      this.dispatching = false;
    }
  }

  private async taskTick(name: string): Promise<void> {
    const task = this.periodicTasks.list().find((candidate) => candidate.name === name);
    if (!task || this.stopping || this.runningTasks.has(name)) {
      return;
    }
    this.runningTasks.add(name);
    try {
      await this.periodicTasks.runExclusive(task);
    } finally {
      this.runningTasks.delete(name);
    }
  }
}
