import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { FieldEncryption } from './crypto/field-encryption';
import { SecretHasher } from './crypto/secret-hasher';
import { Clock, SystemClock } from './time/clock';

/** Injection token for the hasher used for tourist PINs and admin passwords. */
export const PIN_HASHER = Symbol('PIN_HASHER');

@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    {
      provide: FieldEncryption,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        FieldEncryption.single(config.encryption.keyId, config.encryption.key),
    },
    {
      provide: PIN_HASHER,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        new SecretHasher(Buffer.from(config.auth.pinPepper, 'utf8'), 'p1'),
    },
  ],
  exports: [Clock, FieldEncryption, PIN_HASHER],
})
export class SharedModule {}
