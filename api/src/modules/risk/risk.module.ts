import { Module } from '@nestjs/common';
import { AdminRiskController } from './admin-risk.controller';
import { BlocklistService } from './blocklist.service';
import { RiskService } from './risk.service';

@Module({
  controllers: [AdminRiskController],
  providers: [BlocklistService, RiskService],
  exports: [BlocklistService, RiskService],
})
export class RiskModule {}
