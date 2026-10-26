import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { PayeesModule } from '../payees/payees.module';
import { LimitsService } from './limits.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [CardsModule, PayeesModule],
  controllers: [QuotesController],
  providers: [QuotesService, LimitsService],
  exports: [QuotesService, LimitsService],
})
export class QuotesModule {}
