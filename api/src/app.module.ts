import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RateLimitModule } from './common/guards/rate-limit.module';
import { RequestContextMiddleware } from './common/interceptors/request-context.middleware';
import { buildLoggerParams } from './common/logging/logger.config';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { AppConfig } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';
import { ProcessRole } from './jobs/worker-runtime.service';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigurationModule } from './modules/configuration/configuration.module';
import { DevModule } from './modules/dev/dev.module';
import { CardsModule } from './modules/cards/cards.module';
import { PayeesModule } from './modules/payees/payees.module';
import { ProviderModule } from './modules/provider/provider.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { HealthModule } from './modules/health/health.module';
import { HttpMetricsMiddleware } from './modules/health/http-metrics.middleware';
import { NotificationChannelsModule } from './modules/notifications/notification-channels.module';
import { SharedModule } from './shared/shared.module';

export interface AppModuleOptions {
  role: ProcessRole;
  /** Tests pass an explicit configuration; processes load it from the environment. */
  config?: AppConfig;
}

@Module({})
export class AppModule implements NestModule {
  static forRoot(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(options.config),
        LoggerModule.forRootAsync({ inject: [AppConfig], useFactory: buildLoggerParams }),
        DatabaseModule,
        SharedModule,
        RateLimitModule,
        AuditModule,
        HealthModule,
        JobsModule.forRoot(options.role),
        NotificationChannelsModule,
        AuthModule,
        AdminModule,
        ConfigurationModule,
        DevModule,
        ProviderModule,
        CardsModule,
        PayeesModule,
        QuotesModule,
        PaymentsModule,
        NotificationsModule,
        TicketsModule,
        AnalyticsModule,
        RefundsModule,
        ReconciliationModule,
        WebhooksModule,
      ],
      providers: [
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_PIPE, useFactory: createValidationPipe },
        // Guard order matters: authentication first, so rate limits can key on the principal.
        { provide: APP_GUARD, useExisting: AuthGuard },
        { provide: APP_GUARD, useClass: RateLimitGuard },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware, HttpMetricsMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
