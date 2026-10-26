import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/** Records request duration labelled with the matched route template, not the raw URL. */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const end = this.metrics.httpDuration.startTimer();
    res.on('finish', () => {
      const routePath = (req.route as { path?: string } | undefined)?.path;
      const route = routePath ? `${req.baseUrl ?? ''}${routePath}` : 'unmatched';
      end({ method: req.method, route, status_class: `${Math.floor(res.statusCode / 100)}xx` });
    });
    next();
  }
}
