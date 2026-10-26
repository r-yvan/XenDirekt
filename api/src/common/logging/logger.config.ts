import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import { AppConfig } from '../../config/app-config';
import { RequestContext } from '../context/request-context';
import { redact, scrubCardNumbers } from './redaction';

const QUIET_PATHS = ['/health/live', '/health/ready', '/metrics'];

/** Paths only; query strings can carry search terms such as phone numbers or emails. */
function pathOf(url: string | undefined): string {
  if (!url) {
    return '';
  }
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

/**
 * Structured JSON logs with correlation IDs. Request and response serializers emit an
 * allowlist of fields only (method, path, status), so headers, bodies and query strings,
 * which may hold tokens or personal data, are never logged.
 */
export function buildLoggerParams(config: AppConfig): Params {
  return {
    pinoHttp: {
      level: config.logLevel,
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const id = RequestContext.normaliseIncomingId(req.headers['x-request-id']);
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: {
        ignore: (req: IncomingMessage) => QUIET_PATHS.includes(pathOf(req.url)),
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) {
          return 'error';
        }
        if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      serializers: {
        req: (req: { id?: unknown; method?: string; url?: string }) => ({
          id: req.id,
          method: req.method,
          path: pathOf(req.url),
        }),
        res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
        err: (err: Error) => ({
          type: err.name,
          message: scrubCardNumbers(err.message ?? ''),
          stack: config.isProduction ? undefined : err.stack,
        }),
      },
      formatters: {
        level: (label: string) => ({ level: label }),
      },
      hooks: {
        // Last line of defence: scrub card-number-like strings and secret keys from every log call.
        logMethod(args, method) {
          const cleaned = args.map((arg) =>
            typeof arg === 'string' ? scrubCardNumbers(arg) : redact(arg),
          );
          method.apply(this, cleaned as Parameters<typeof method>);
        },
      },
      base: { service: 'xendirekt-api', env: config.environment },
      transport: undefined,
    },
  };
}
