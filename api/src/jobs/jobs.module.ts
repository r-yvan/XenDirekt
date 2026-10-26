import { DynamicModule, Global, Module } from '@nestjs/common';
import { OutboxHandlerRegistry } from './outbox/outbox-handler.registry';
import { OutboxDispatcher } from './outbox/outbox.dispatcher';
import { OutboxService } from './outbox/outbox.service';
import { PeriodicTaskRegistry } from './periodic-task.registry';
import { PROCESS_ROLE, ProcessRole, WorkerRuntime } from './worker-runtime.service';

@Global()
@Module({})
export class JobsModule {
  static forRoot(role: ProcessRole): DynamicModule {
    return {
      module: JobsModule,
      providers: [
        { provide: PROCESS_ROLE, useValue: role },
        OutboxService,
        OutboxHandlerRegistry,
        OutboxDispatcher,
        PeriodicTaskRegistry,
        WorkerRuntime,
      ],
      exports: [
        OutboxService,
        OutboxHandlerRegistry,
        OutboxDispatcher,
        PeriodicTaskRegistry,
        WorkerRuntime,
        PROCESS_ROLE,
      ],
    };
  }
}
