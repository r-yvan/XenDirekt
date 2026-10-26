import { Module } from '@nestjs/common';
import { RiskModule } from '../risk/risk.module';
import { PayeesController } from './payees.controller';
import { PayeesService } from './payees.service';

@Module({
  imports: [RiskModule],
  controllers: [PayeesController],
  providers: [PayeesService],
  exports: [PayeesService],
})
export class PayeesModule {}
