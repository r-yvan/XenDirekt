import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../context/request-context';

type RequestWithId = Request & { id?: unknown };

/** Runs the rest of the request inside an AsyncLocalStorage scope carrying the correlation ID. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const existing = typeof req.id === 'string' ? req.id : undefined;
    const correlationId =
      existing ?? RequestContext.normaliseIncomingId(req.headers['x-request-id']);
    req.id = correlationId;
    if (!res.headersSent) {
      res.setHeader('X-Request-Id', correlationId);
    }
    RequestContext.run({ correlationId }, () => next());
  }
}
