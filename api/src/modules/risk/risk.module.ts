import { Module } from '@nestjs/common';
import { BlocklistService } from './blocklist.service';
import { RiskService } from './risk.service';

@Module({ providers: [BlocklistService, RiskService], exports: [BlocklistService, RiskService] })
export class RiskModule {}
