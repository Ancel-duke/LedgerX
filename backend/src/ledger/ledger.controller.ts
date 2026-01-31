import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { PostTransactionDto } from './dto/post-transaction.dto';
import { CreateLedgerAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { CurrentOrg } from '../common/decorators/current-org.decorator';

@Controller('ledger')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  postTransaction(
    @CurrentOrg() organizationId: string,
    @Body() dto: PostTransactionDto,
  ) {
    return this.ledgerService.postTransaction(organizationId, dto);
  }

  @Get('transactions')
  getTransactions(
    @CurrentOrg() organizationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('referenceType') referenceType?: string,
    @Query('referenceId') referenceId?: string,
  ) {
    return this.ledgerService.getTransactions(
      organizationId,
      { page, limit },
      referenceType || referenceId ? { referenceType, referenceId } : undefined,
    );
  }

  @Get('transactions/:id')
  getTransactionById(
    @CurrentOrg() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.ledgerService.getTransactionById(organizationId, id);
  }

  @Get('balances')
  getBalances(
    @CurrentOrg() organizationId: string,
    @Query('accountIds') accountIds?: string | string[],
  ) {
    const ids = Array.isArray(accountIds)
      ? accountIds
      : accountIds
        ? (typeof accountIds === 'string' ? accountIds.split(',') : [accountIds])
        : undefined;
    return this.ledgerService.getBalances(organizationId, ids);
  }

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  createAccount(
    @CurrentOrg() organizationId: string,
    @Body() dto: CreateLedgerAccountDto,
  ) {
    return this.ledgerService.createAccount(organizationId, dto);
  }

  @Get('accounts')
  getAccounts(@CurrentOrg() organizationId: string) {
    return this.ledgerService.getAccounts(organizationId);
  }
}
