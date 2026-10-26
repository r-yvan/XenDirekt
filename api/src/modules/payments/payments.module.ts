import { Module } from '@nestjs/common';
import { PaymentSweeperTask } from '../../jobs/payment-sweeper.task';
import { AuthModule } from '../auth/auth.module';
import { CardsModule } from '../cards/cards.module';
import { PayeesModule } from '../payees/payees.module';
import { QuotesModule } from '../quotes/quotes.module';
import { RiskModule } from '../risk/risk.module';
import { PaymentOrchestrator } from './application/payment-orchestrator';
import { PaymentTransitionsService } from './application/payment-transitions.service';
import { PaymentsService } from './application/payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [AuthModule, CardsModule, PayeesModule, QuotesModule, RiskModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentTransitionsService, PaymentOrchestrator, PaymentSweeperTask],
  exports: [PaymentsService, PaymentTransitionsService, PaymentOrchestrator],
})
export class PaymentsModule {}
