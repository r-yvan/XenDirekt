import { Module } from '@nestjs/common';
import { DevInboxController } from './dev-inbox.controller';

/** Developer conveniences. Every endpoint here refuses to work outside local and test. */
@Module({ controllers: [DevInboxController] })
export class DevModule {}
