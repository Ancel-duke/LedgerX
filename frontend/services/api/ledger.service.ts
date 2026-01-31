import { apiClient } from './api-client';
import { unwrapResponse, asArray, unwrapListResponse } from '@/lib/api-response';

export interface LedgerAccount {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  currency: string;
  createdAt: string;
}

export interface LedgerEntryRow {
  id: string;
  accountId: string;
  direction: string;
  amount: string;
  account?: { id: string; name: string; type: string; currency: string };
}

export interface LedgerTransaction {
  id: string;
  organizationId: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  entries: LedgerEntryRow[];
}

export interface BalanceRow {
  accountId: string;
  balance: string;
}

class LedgerService {
  async getAccounts(): Promise<LedgerAccount[]> {
    const res = await apiClient.get('/ledger/accounts');
    return asArray<LedgerAccount>(unwrapResponse(res.data));
  }

  async getBalances(accountIds?: string[]): Promise<BalanceRow[]> {
    const params = accountIds?.length ? { accountIds: accountIds.join(',') } : {};
    const res = await apiClient.get('/ledger/balances', { params });
    return asArray<BalanceRow>(unwrapResponse(res.data));
  }

  async getTransactions(params?: {
    page?: number;
    limit?: number;
    referenceType?: string;
    referenceId?: string;
  }): Promise<{ data: LedgerTransaction[]; meta?: { total: number; page: number; limit: number } }> {
    const res = await apiClient.get('/ledger/transactions', { params });
    return unwrapListResponse<LedgerTransaction, { total: number; page: number; limit: number }>(res.data);
  }

  async getTransactionById(id: string): Promise<LedgerTransaction | null> {
    const res = await apiClient.get(`/ledger/transactions/${id}`);
    const out = unwrapResponse<LedgerTransaction | null>(res.data);
    return out ?? null;
  }
}

export const ledgerService = new LedgerService();
