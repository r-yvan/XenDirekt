import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadLocalEnvFile } from './config/load-env-file';

loadLocalEnvFile();

/**
 * Background worker process: outbox dispatch (provider calls, notifications) and periodic jobs
 * (stale-payment sweeper, reconciliation). No HTTP listener. Scale horizontally; jobs are claimed
 * with SKIP LOCKED and periodic tasks take advisory locks.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot({ role: 'worker' }), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

void bootstrap();
