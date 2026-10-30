import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Kysely } from 'kysely';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { AppModule } from '../../src/app.module';
import { RateLimitStore } from '../../src/common/guards/rate-limit.store';
import { DATABASE } from '../../src/database/database.module';
import type { DB } from '../../src/database/schema';
import { configureHttpApp } from '../../src/http-app';
import { OutboxDispatcher } from '../../src/jobs/outbox/outbox.dispatcher';
import { EmailSender, SmsSender } from '../../src/modules/notifications/channels/channel.types';
import { PAYMENT_PROVIDER } from '../../src/modules/provider/domain/payment-provider';
import { MockPaymentProvider } from '../../src/modules/provider/mock/mock-payment.provider';
import { ManualClock, Clock } from '../../src/shared/time/clock';
import { InMemoryEmailSender, InMemorySmsSender } from './in-memory-senders';
import { resetDatabase } from './test-database';
import { testConfig } from './test-env';

export interface E2eApp {
  app: NestExpressApplication;
  http: TestAgent;
  db: Kysely<DB>;
  clock: ManualClock;
  email: InMemoryEmailSender;
  sms: InMemorySmsSender;
  dispatcher: OutboxDispatcher;
  reset(): Promise<void>;
  close(): Promise<void>;
}

/** Boots the real application module and HTTP stack against the test database. */
export async function createE2eApp(env: Record<string, string> = {}): Promise<E2eApp> {
  const clock = new ManualClock(new Date());
  const email = new InMemoryEmailSender();
  const sms = new InMemorySmsSender();
  const config = testConfig({ EMAIL_TRANSPORT: 'smtp', SMS_TRANSPORT: 'dev-email-bridge', ...env });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot({ role: 'api', config })],
  })
    .overrideProvider(Clock)
    .useValue(clock)
    .overrideProvider(EmailSender)
    .useValue(email)
    .overrideProvider(SmsSender)
    .useValue(sms)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
    rawBody: true,
  });
  configureHttpApp(app);
  await app.init();
  const db = app.get<Kysely<DB>>(DATABASE);
  const rateLimits = app.get(RateLimitStore);
  return {
    app,
    http: request(app.getHttpServer()),
    db,
    clock,
    email,
    sms,
    dispatcher: app.get(OutboxDispatcher),
    async reset() {
      await resetDatabase(db);
      await rateLimits.close();
      const provider = app.get<unknown>(PAYMENT_PROVIDER);
      if (provider instanceof MockPaymentProvider) {
        provider.reset();
      }
      email.sent.length = 0;
      sms.sent.length = 0;
      clock.set(new Date());
    },
    close: () => app.close(),
  };
}
