'use client';

import { useQuery } from '@tanstack/react-query';
import { ledgerService } from '@/services/api/ledger.service';
import { useAuth } from '@/lib/auth/auth-provider';
import Link from 'next/link';

export default function LedgerPage() {
  const { organization } = useAuth();
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['ledger', 'accounts'],
    queryFn: () => ledgerService.getAccounts(),
  });
  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ['ledger', 'balances', accounts?.map((a) => a.id)],
    queryFn: () => ledgerService.getBalances(accounts?.map((a) => a.id)),
    enabled: !!accounts?.length,
  });
  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['ledger', 'transactions', 1, 20],
    queryFn: () => ledgerService.getTransactions({ page: 1, limit: 20 }),
  });

  const balanceMap = new Map<string, string>();
  balances?.forEach((b) => balanceMap.set(b.accountId, b.balance));

  if (accountsLoading || (accounts?.length && balancesLoading)) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Loading ledger…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Ledger</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Read-only view of accounts and transactions for {organization?.name ?? 'your organization'}.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Accounts & Balances</h2>
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Currency</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {accounts?.length ? (
                accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 text-sm text-neutral-900">{a.name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{a.type}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{a.currency}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {balanceMap.get(a.id) ?? '0'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500 text-sm">
                    No accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Recent Transactions</h2>
        {txLoading ? (
          <p className="text-neutral-600 text-sm">Loading transactions…</p>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Ref</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {txData?.data?.length ? (
                  txData.data.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 text-sm">
                        <Link href={`/dashboard/ledger/transactions/${tx.id}`} className="text-blue-600 hover:underline">
                          {tx.referenceType}:{tx.referenceId?.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {tx.entries?.length ?? 0} entries
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-neutral-500 text-sm">
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
