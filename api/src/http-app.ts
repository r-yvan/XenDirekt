import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppConfig } from './config/app-config';

export function buildOpenApiDocument(app: NestExpressApplication): OpenAPIObject {
  const document = new DocumentBuilder()
    .setTitle('XenDirekt API')
    .setDescription(
      'Payment orchestration API for the XenDirekt mobile app (/v1) and internal operations (/v1/admin). ' +
        'Errors use a stable envelope: { error: { code, message, details?, requestId } }.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'user')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'admin')
    .build();
  return SwaggerModule.createDocument(app, document);
}

/**
 * HTTP hardening shared by main.ts and the e2e test harness, so tests exercise the same stack.
 */
export function configureHttpApp(app: NestExpressApplication): AppConfig {
  const config = app.get(AppConfig);
  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.http.trustProxy ? 1 : false);
  app.disable('x-powered-by');
  app.use(
    helmet({
      // The API serves JSON; the only HTML is Swagger (non-production) and the dev mock pages.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          // Helmet adds this by default. Over plain-HTTP development it makes browsers
          // post the mock card and 3-D Secure forms to https://, which fails the TLS
          // handshake; production is HTTPS-only, so it stays there.
          upgradeInsecureRequests: config.isProduction ? [] : null,
        },
      },
      strictTransportSecurity: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
    }),
  );
  if (config.http.corsAllowedOrigins.length > 0) {
    app.enableCors({
      origin: config.http.corsAllowedOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'Idempotency-Key',
        'X-Request-Id',
        'X-Step-Up-Token',
        'X-Device-Id',
      ],
      credentials: false,
      maxAge: 600,
    });
  }
  // Settlement files are the one large upload; everything else stays small.
  app.use('/v1/admin/reconciliation/settlement-files', json({ limit: '6mb' }));
  app.useBodyParser('json', { limit: '64kb' });
  app.useBodyParser('urlencoded', { limit: '16kb', extended: false });
  if (config.http.enableApiDocs) {
    SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
      jsonDocumentUrl: 'docs/openapi.json',
    });
  }
  app.enableShutdownHooks();
  return config;
}
