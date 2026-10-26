import { Controller, Get, Headers, HttpCode, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Kysely, sql } from 'kysely';
import { Public } from '../../common/decorators/public.decorator';
import { AppError } from '../../common/errors/app-error';
import { AppConfig } from '../../config/app-config';
import { InjectDatabase } from '../../database/database.module';
import { hasPendingMigrations } from '../../database/migrator';
import type { DB } from '../../database/schema';
import { constantTimeEqual } from '../../shared/crypto/tokens';
import { RateLimitStore } from '../../common/guards/rate-limit.store';
import { MetricsService } from './metrics.service';

type CheckStatus = 'up' | 'down' | 'not_configured';

/**
 * Liveness and readiness for the orchestrator, plus Prometheus metrics. Responses carry
 * component status words only: no hostnames, versions, credentials or error text.
 */
@ApiExcludeController()
@Public()
@Controller()
export class HealthController {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly config: AppConfig,
    private readonly metrics: MetricsService,
    private readonly rateLimitStore: RateLimitStore,
  ) {}

  @Get('health/live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('health/ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks: Record<string, CheckStatus> = {
      database: 'down',
      migrations: 'down',
      redis: 'not_configured',
    };
    try {
      await sql`SELECT 1`.execute(this.db);
      checks.database = 'up';
      checks.migrations = (await hasPendingMigrations(this.db as unknown as Kysely<unknown>))
        ? 'down'
        : 'up';
    } catch {
      checks.database = 'down';
    }
    if (this.config.redisUrl) {
      checks.redis = (await this.rateLimitStore.ping()) ? 'up' : 'down';
    }
    const ready = Object.values(checks).every((status) => status !== 'down');
    res.status(ready ? 200 : 503);
    return {
      status: ready ? 'ok' : 'unavailable',
      checks,
      provider: { name: this.config.provider.name, simulated: this.config.usesSimulatedProvider },
    };
  }

  @Get('metrics')
  @HttpCode(200)
  async metricsEndpoint(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const token = this.config.metricsToken;
    if (token && !constantTimeEqual(authorization ?? '', `Bearer ${token}`)) {
      throw new AppError('UNAUTHENTICATED');
    }
    res.setHeader('Content-Type', this.metrics.registry.contentType);
    res.send(await this.metrics.registry.metrics());
  }
}
