'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { diagnosticsService } from '@/services/api/diagnostics.service';
import { getHealth, getReadiness } from '@/services/api/health.service';
import { useAuth } from '@/lib/auth/auth-provider';

export default function DiagnosticsPage() {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();

  const canAccess = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  if (user && !canAccess) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900 mb-2">Diagnostics & Health</h1>
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <p className="font-medium">Not authorized</p>
          <p className="text-sm mt-1">You need admin or compliance (manager) role to view diagnostics.</p>
        </div>
      </div>
    );
  }

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
  });
  const readyQuery = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: getReadiness,
  });
  const aggregatesQuery = useQuery({
    queryKey: ['diagnostics', 'aggregates'],
    queryFn: () => diagnosticsService.getAggregates(),
  });
  const reportQuery = useQuery({
    queryKey: ['diagnostics', 'report'],
    queryFn: () => diagnosticsService.getReport(),
  });
  const historyQuery = useQuery({
    queryKey: ['diagnostics', 'report', 'history'],
    queryFn: () => diagnosticsService.getReportHistory(20),
  });
  const jobsQuery = useQuery({
    queryKey: ['diagnostics', 'jobs'],
    queryFn: () => diagnosticsService.getJobs(),
  });
  const flagsQuery = useQuery({
    queryKey: ['diagnostics', 'feature-flags'],
    queryFn: () => diagnosticsService.getFeatureFlags(organization?.id),
  });

  const generateReport = useMutation({
    mutationFn: () => diagnosticsService.generateReport(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'report'] });
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'report', 'history'] });
    },
  });

  const isHealthy = healthQuery.data?.status === 'ok' || readyQuery.data?.status === 'ok';
  const isReady = readyQuery.data?.status === 'ok';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Diagnostics & Health</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Health status, diagnostic reports, and scheduled jobs for {organization?.name ?? 'your organization'}.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Health / Readiness</h2>
        <div
          className={`p-4 rounded-lg border ${
            isHealthy ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <p className="font-medium">
            {healthQuery.isLoading || readyQuery.isLoading
              ? 'Checking…'
              : isReady
                ? 'All systems operational'
                : 'Degraded or checking…'}
          </p>
          <p className="text-sm mt-1">
            Liveness: {healthQuery.data?.status ?? '—'} · Readiness: {readyQuery.data?.status ?? '—'}
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Current Aggregates</h2>
        {aggregatesQuery.data && (
          <div className="bg-white border border-neutral-200 rounded-lg p-4 text-sm">
            <pre className="whitespace-pre-wrap text-neutral-700">
              {JSON.stringify(aggregatesQuery.data, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Last Diagnostic Report</h2>
        <button
          type="button"
          onClick={() => generateReport.mutate()}
          disabled={generateReport.isPending}
          className="mb-4 px-4 py-2 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
        >
          {generateReport.isPending ? 'Generating…' : 'Generate report'}
        </button>
        {reportQuery.data && !('message' in reportQuery.data) && (
          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="font-medium text-neutral-900">{reportQuery.data.summary}</p>
            {reportQuery.data.aiSummary && (
              <p className="text-sm text-neutral-600 mt-2">{reportQuery.data.aiSummary}</p>
            )}
            <ul className="mt-3 list-disc list-inside text-sm text-neutral-700">
              {reportQuery.data.findings?.map((f, i) => (
                <li key={i}>
                  [{f.severity}] {f.likelyCause} — {f.suggestedAction}
                </li>
              ))}
            </ul>
          </div>
        )}
        {reportQuery.data && 'message' in reportQuery.data && (
          <p className="text-neutral-500 text-sm">{(reportQuery.data as { message: string }).message}</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Report History</h2>
        {historyQuery.data?.length ? (
          <ul className="space-y-2 text-sm text-neutral-700">
            {historyQuery.data.slice(0, 10).map((r) => (
              <li key={r.id}>
                {new Date(r.at).toLocaleString()} — {r.summary}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-neutral-500 text-sm">No report history yet.</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Scheduled Jobs</h2>
        {jobsQuery.data?.length ? (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Last run</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {jobsQuery.data.map((j) => (
                  <tr key={j.name}>
                    <td className="px-4 py-3 text-sm text-neutral-900">{j.name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{j.lastRunAt ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{j.lastStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-sm">No jobs registered.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Feature Flags (read-only)</h2>
        {flagsQuery.data && (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {Object.entries(flagsQuery.data).map(([key, value]) => (
                  <tr key={key}>
                    <td className="px-4 py-3 text-sm text-neutral-900">{key}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{value ? 'true' : 'false'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
