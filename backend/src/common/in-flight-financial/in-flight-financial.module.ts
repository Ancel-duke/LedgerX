import { Global, Module } from '@nestjs/common';
import { InFlightFinancialService } from './in-flight-financial.service';

@Global()
@Module({
  providers: [InFlightFinancialService],
  exports: [InFlightFinancialService],
})
export class InFlightFinancialModule {}
