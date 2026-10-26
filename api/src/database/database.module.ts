import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Kysely } from 'kysely';
import { AppConfig } from '../config/app-config';
import { createDatabase } from './database.factory';
import type { DB } from './schema';

/** Injection token for the shared Kysely instance. */
export const DATABASE = Symbol('DATABASE');

export const InjectDatabase = (): ParameterDecorator & PropertyDecorator => Inject(DATABASE);

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [AppConfig],
      useFactory: (config: AppConfig): Kysely<DB> =>
        createDatabase({
          url: config.database.url,
          poolMax: config.database.poolMax,
          ssl: config.database.ssl,
        }),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}
