'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ledgerService } from '@/services/api/ledger.service';

export default function LedgerTransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: tx, isLoading, error } = useQuery({
    queryKey: ['ledger', 'transaction', id],
    queryFn: () => ledgerService.getTransactionById(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Loading transaction…</p>
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-4">Transaction not found.</p>
        <Link href="/dashboard/ledger" className="text-blue-600 hover:underline">
          Back to Ledger
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/dashboard/ledger" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Ledger
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Transaction</h1>
      <p className="text-sm text-neutral-600 mb-6">
        {tx.referenceType} : {tx.referenceId} · {new Date(tx.createdAt).toLocaleString()}
      </p>
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Account</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Direction</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {tx.entries?.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 text-sm text-neutral-900">
                  {e.account?.name ?? e.accountId}
                </td>
                <td className="px-4 py-3 text-sm text-neutral-600">{e.direction}</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{e.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
