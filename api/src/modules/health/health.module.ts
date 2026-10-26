import { Global, Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HttpMetricsMiddleware } from './http-metrics.middleware';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [HealthController],
  providers: [MetricsService, HttpMetricsMiddleware],
  exports: [MetricsService, HttpMetricsMiddleware],
})
export class HealthModule {}
