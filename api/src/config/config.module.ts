import { DynamicModule, Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';
import { parseEnv } from './env.schema';
import { enforceStartupGuards } from './startup-guards';

@Global()
@Module({})
export class ConfigModule {
  /**
   * Loads configuration from process.env, or from an explicit AppConfig in tests.
   * Startup guards run here so an unsafe configuration never reaches the HTTP listener.
   */
  static forRoot(config?: AppConfig): DynamicModule {
    const resolved = config ?? new AppConfig(parseEnv(process.env));
    enforceStartupGuards(resolved);
    return {
      module: ConfigModule,
      providers: [{ provide: AppConfig, useValue: resolved }],
      exports: [AppConfig],
    };
  }
}
