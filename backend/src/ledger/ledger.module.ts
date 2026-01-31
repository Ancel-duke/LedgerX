import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { LedgerBootstrapService } from './ledger-bootstrap.service';

@Module({
  controllers: [LedgerController],
  providers: [LedgerService, LedgerBootstrapService],
  exports: [LedgerService, LedgerBootstrapService],
})
export class LedgerModule {}
