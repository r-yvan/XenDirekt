import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadLocalEnvFile } from './config/load-env-file';
import { configureHttpApp } from './http-app';

loadLocalEnvFile();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot({ role: 'api' }), {
    bufferLogs: true,
  });
  const config = configureHttpApp(app);
  await app.listen(config.http.port);
}

void bootstrap();
