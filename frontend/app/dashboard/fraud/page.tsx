'use client';

import { useQuery } from '@tanstack/react-query';
import { fraudDetectionService } from '@/services/api/fraud-detection.service';
import { useAuth } from '@/lib/auth/auth-provider';

export default function FraudPage() {
  const { organization } = useAuth();

  const orgBlockQuery = useQuery({
    queryKey: ['fraud', 'org-block-check'],
    queryFn: () => fraudDetectionService.orgBlockCheck(),
  });

  const flaggedQuery = useQuery({
    queryKey: ['fraud', 'flagged', 1, 50],
    queryFn: () => fraudDetectionService.listFlagged({ page: 1, limit: 50 }),
  });

  const isBlocked = orgBlockQuery.data?.block === true;
  const blockedReason = orgBlockQuery.data?.reason ?? 'Account temporarily restricted due to risk policy.';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Fraud & Risk</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Risk scores, flagged transactions, and org block status for {organization?.name ?? 'your organization'}.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Organization Risk Status</h2>
        {orgBlockQuery.isLoading ? (
          <p className="text-neutral-600 text-sm">Loading…</p>
        ) : (
          <div
            className={`p-4 rounded-lg border ${
              isBlocked ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
            }`}
          >
            <p className="font-medium">
              {isBlocked ? 'Restricted' : 'All systems operational'}
            </p>
            <p className="text-sm mt-1">
              {isBlocked ? blockedReason : 'No risk-based restrictions on this organization.'}
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Flagged Transactions</h2>
        {flaggedQuery.isLoading ? (
          <p className="text-neutral-600 text-sm">Loading…</p>
        ) : flaggedQuery.data?.data?.length ? (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Entity type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Entity ID</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Risk score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {flaggedQuery.data.data.map((item, i) => (
                  <tr key={`${item.entityType}-${item.entityId}-${i}`}>
                    <td className="px-4 py-3 text-sm text-neutral-900">{item.entityType}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600 font-mono">{item.entityId}</td>
                    <td className="px-4 py-3 text-sm text-right">{item.riskScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-sm">No flagged transactions.</p>
        )}
      </section>
    </div>
  );
}
