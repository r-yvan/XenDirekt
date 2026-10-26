import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RiskModule } from '../risk/risk.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  imports: [AuthModule, RiskModule],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
