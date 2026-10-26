import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../app.module';
import { loadLocalEnvFile } from '../config/load-env-file';
import { buildOpenApiDocument } from '../http-app';

/**
 * Writes the OpenAPI document to api/docs/openapi.json without starting a listener.
 * Requires the usual environment (a database URL is needed to build the module graph).
 */
async function main(): Promise<void> {
  loadLocalEnvFile();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot({ role: 'api' }), {
    logger: false,
  });
  const document = buildOpenApiDocument(app);
  const target = resolve(__dirname, '..', '..', 'docs', 'openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`OpenAPI document written to ${target}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
