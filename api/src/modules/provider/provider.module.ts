import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { Clock } from '../../shared/time/clock';
import { PAYMENT_PROVIDER, PaymentProvider } from './domain/payment-provider';
import { HybridPaymentProvider } from './hybrid/hybrid-payment.provider';
import { MockPaymentProvider } from './mock/mock-payment.provider';
import { MockProviderPagesController } from './mock/mock-provider-pages.controller';
import { ProviderGateway } from './provider.gateway';
import { XentriPayHttpClient } from './xentripay/xentripay-http.client';
import { XentriPayPaymentProvider } from './xentripay/xentripay-payment.provider';

@Global()
@Module({
  controllers: [MockProviderPagesController],
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [AppConfig, Clock],
      useFactory: (config: AppConfig, clock: Clock): PaymentProvider => {
        const mock = () =>
          new MockPaymentProvider(config.http.publicBaseUrl, config.provider.mock.latencyMs, () =>
            clock.now(),
          );
        const xentripay = () =>
          new XentriPayPaymentProvider(
            new XentriPayHttpClient({
              baseUrl: config.provider.xentripay.baseUrl,
              apiKey: config.provider.xentripay.apiKey ?? '',
              responseTimeoutMs: config.provider.xentripay.responseTimeoutMs,
            }),
          );
        switch (config.provider.name) {
          case 'mock':
            return mock();
          case 'hybrid':
            return new HybridPaymentProvider(mock(), xentripay());
          default:
            return xentripay();
        }
      },
    },
    ProviderGateway,
  ],
  exports: [PAYMENT_PROVIDER, ProviderGateway],
})
export class ProviderModule {}
