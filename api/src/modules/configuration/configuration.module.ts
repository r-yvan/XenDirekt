import { Global, Module } from '@nestjs/common';
import { ClientConfigController } from './client-config.controller';
import { ConfigurationService } from './configuration.service';

@Global()
@Module({
  controllers: [ClientConfigController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
