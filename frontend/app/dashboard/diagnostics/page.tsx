'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { diagnosticsService } from '@/services/api/diagnostics.service';
import { getHealth, getReadiness } from '@/services/api/health.service';
import { useAuth } from '@/lib/auth/auth-provider';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function DiagnosticsPage() {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();
  const canAccess = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    enabled: canAccess ?? false,
  });
  const readyQuery = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: getReadiness,
    enabled: canAccess ?? false,
  });
  const aggregatesQuery = useQuery({
    queryKey: ['diagnostics', 'aggregates'],
    queryFn: () => diagnosticsService.getAggregates(),
    enabled: canAccess ?? false,
  });
  const reportQuery = useQuery({
    queryKey: ['diagnostics', 'report'],
    queryFn: () => diagnosticsService.getReport(),
    enabled: canAccess ?? false,
  });
  const historyQuery = useQuery({
    queryKey: ['diagnostics', 'report', 'history'],
    queryFn: () => diagnosticsService.getReportHistory(20),
    enabled: canAccess ?? false,
  });
  const jobsQuery = useQuery({
    queryKey: ['diagnostics', 'jobs'],
    queryFn: () => diagnosticsService.getJobs(),
    enabled: canAccess ?? false,
  });
  const flagsQuery = useQuery({
    queryKey: ['diagnostics', 'feature-flags'],
    queryFn: () => diagnosticsService.getFeatureFlags(organization?.id),
    enabled: canAccess ?? false,
  });

  const generateReport = useMutation({
    mutationFn: () => diagnosticsService.generateReport(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'report'] });
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'report', 'history'] });
    },
  });

  if (user && !canAccess) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900 mb-2">Diagnostics & Health</h1>
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <p className="font-medium">Not authorized</p>
          <p className="text-sm mt-1">You need admin or manager role to view diagnostics.</p>
        </div>
      </div>
    );
  }

  const loading = healthQuery.isLoading || readyQuery.isLoading;
  const livenessOk = healthQuery.data?.status === 'ok';
  const readinessOk = readyQuery.data?.status === 'ok';
  const healthStatus = loading
    ? 'checking'
    : readinessOk && livenessOk
      ? 'healthy'
      : !livenessOk && !readinessOk
        ? 'unavailable'
        : 'degraded';
  const lastCheckAt = readyQuery.data?.timestamp ?? healthQuery.data?.timestamp;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Page header */}
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900">Diagnostics & Health</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Health status, key metrics, and diagnostic reports for {organization?.name ?? 'your organization'}.
        </p>
      </header>

      {/* System health status */}
      <section className="mb-8" aria-labelledby="health-heading">
        <h2 id="health-heading" className="text-lg font-medium text-neutral-800 mb-4">System health status</h2>
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-4">
            <StatusBadge status={healthStatus} />
            <div className="flex flex-wrap gap-6 text-sm">
              <span>
                <span className="text-neutral-500">Liveness:</span>{' '}
                <span className={livenessOk ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                  {loading ? '—' : livenessOk ? 'Healthy' : 'Unhealthy'}
                </span>
              </span>
              <span>
                <span className="text-neutral-500">Readiness:</span>{' '}
                <span className={readinessOk ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
                  {loading ? '—' : readinessOk ? 'Ready' : 'Not ready'}
                </span>
              </span>
              {typeof lastCheckAt === 'string' ? (
                <span className="text-neutral-500">
                  Last check: {new Date(lastCheckAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>
        </Card>
      </section>

      {/* Key metrics (aggregates) — KPI cards, no raw JSON */}
      <section className="mb-8" aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="text-lg font-medium text-neutral-800 mb-4">Key metrics</h2>
        {aggregatesQuery.data?.metrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Auth failures"
              value={aggregatesQuery.data.metrics.authFailuresTotal}
              description="Failed authentication attempts"
            />
            <MetricCard
              label="Payment failures"
              value={aggregatesQuery.data.metrics.paymentFailuresTotal}
              description="Failed payment operations"
            />
            <MetricCard
              label="Circuit breaker opens"
              value={aggregatesQuery.data.metrics.circuitOpenTotal}
              description="External provider failures"
            />
            <MetricCard
              label="Rate limit exceeded"
              value={aggregatesQuery.data.metrics.rateLimitExceededTotal}
              description="Abuse protection triggers"
            />
          </div>
        ) : aggregatesQuery.isLoading ? (
          <Card className="p-8 flex justify-center">
            <LoadingSpinner size="md" />
          </Card>
        ) : (
          <Card className="p-6 text-neutral-500 text-sm">No aggregate data available.</Card>
        )}
      </section>

      {/* Circuit breaker status */}
      <section className="mb-8" aria-labelledby="circuits-heading">
        <h2 id="circuits-heading" className="text-lg font-medium text-neutral-800 mb-4">Circuit breaker status</h2>
        {aggregatesQuery.data?.circuits?.length ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">State</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Failure count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {aggregatesQuery.data.circuits.map((c) => (
                    <tr key={c.key}>
                      <td className="px-4 py-3 text-sm text-neutral-900">{c.key}</td>
                      <td className="px-4 py-3">
                        <CircuitStateBadge state={c.state} />
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-700">{c.failures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-neutral-600 text-sm">
            No active circuit breakers. External providers are within normal limits.
          </Card>
        )}
      </section>

      {/* Diagnostic reports */}
      <section className="mb-8" aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="text-lg font-medium text-neutral-800 mb-4">Diagnostic reports</h2>
        <Card className="p-5 sm:p-6">
          {reportQuery.data && !('message' in reportQuery.data) ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm text-neutral-500">Generated at</p>
                  <p className="font-medium text-neutral-900">{new Date(reportQuery.data.at).toLocaleString()}</p>
                </div>
                <span className="text-sm text-neutral-600">Overall: {reportQuery.data.summary}</span>
              </div>
              {reportQuery.data.aiSummary && (
                <p className="text-sm text-neutral-700 mb-3">{reportQuery.data.aiSummary}</p>
              )}
              {reportQuery.data.findings?.length ? (
                <div>
                  <p className="text-sm font-medium text-neutral-700 mb-2">Key findings</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                    {reportQuery.data.findings.slice(0, 8).map((f, i) => (
                      <li key={i}>
                        <span className="font-medium text-neutral-600">[{f.severity}]</span> {f.likelyCause} — {f.suggestedAction}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-neutral-500 mb-4">
              {reportQuery.data && 'message' in reportQuery.data
                ? (reportQuery.data as { message: string }).message
                : 'No report yet. Generate one to see a summary and key findings.'}
            </p>
          )}
          <div className="pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => generateReport.mutate()}
              disabled={generateReport.isPending}
              className="btn btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {generateReport.isPending && <LoadingSpinner size="sm" />}
              {generateReport.isPending ? 'Generating…' : 'Generate report'}
            </button>
          </div>
        </Card>
      </section>

      {/* Report history (compact) */}
      <section className="mb-8" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-medium text-neutral-800 mb-4">Report history</h2>
        {historyQuery.data?.length ? (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-neutral-200">
              {historyQuery.data.slice(0, 10).map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm text-neutral-700 flex flex-wrap gap-2 items-center">
                  <span className="text-neutral-500">{new Date(r.at).toLocaleString()}</span>
                  <span>{r.summary}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <p className="text-neutral-500 text-sm">No report history yet.</p>
        )}
      </section>

      {/* Scheduled jobs */}
      <section className="mb-8" aria-labelledby="jobs-heading">
        <h2 id="jobs-heading" className="text-lg font-medium text-neutral-800 mb-4">Scheduled jobs</h2>
        {jobsQuery.data?.length ? (
          <Card className="overflow-hidden overflow-x-auto">
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
                    <td className="px-4 py-3 text-sm text-neutral-600">{j.lastRunAt ? new Date(j.lastRunAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{j.lastStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <p className="text-neutral-500 text-sm">No jobs registered.</p>
        )}
      </section>

      {/* Feature flags */}
      <section className="mb-8" aria-labelledby="flags-heading">
        <h2 id="flags-heading" className="text-lg font-medium text-neutral-800 mb-4">Feature flags</h2>
        {flagsQuery.data && Object.keys(flagsQuery.data).length > 0 ? (
          <Card className="overflow-hidden overflow-x-auto">
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
                    <td className="px-4 py-3 text-sm text-neutral-600">{value ? 'On' : 'Off'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <p className="text-neutral-500 text-sm">No feature flags.</p>
        )}
      </section>

      {/* Advanced: Raw diagnostic data (for debugging) */}
      <section className="mb-4" aria-labelledby="raw-heading">
        <details className="group">
          <summary
            id="raw-heading"
            className="cursor-pointer text-sm font-medium text-neutral-600 hover:text-neutral-900 list-none flex items-center gap-2"
          >
            <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
            Raw diagnostic data (for debugging)
          </summary>
          <div className="mt-3 p-4 bg-neutral-100 border border-neutral-200 rounded-lg overflow-x-auto">
            <p className="text-xs text-neutral-500 mb-2">Aggregates and health — for engineers and compliance only.</p>
            <pre className="text-xs text-neutral-700 whitespace-pre-wrap font-mono">
              {JSON.stringify(
                {
                  health: healthQuery.data,
                  readiness: readyQuery.data,
                  aggregates: aggregatesQuery.data ?? null,
                },
                null,
                2
              )}
            </pre>
          </div>
        </details>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: 'healthy' | 'degraded' | 'unavailable' | 'checking' }) {
  const config = {
    healthy: { label: 'Healthy', className: 'bg-green-50 text-green-800 border-green-200', icon: '✅' },
    degraded: { label: 'Degraded', className: 'bg-amber-50 text-amber-800 border-amber-200', icon: '⚠️' },
    unavailable: { label: 'Unavailable', className: 'bg-red-50 text-red-800 border-red-200', icon: '❌' },
    checking: { label: 'Checking…', className: 'bg-neutral-100 text-neutral-600 border-neutral-200', icon: '' },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium ${c.className}`}>
      {c.icon && <span aria-hidden>{c.icon}</span>}
      {c.label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <Card className="p-4" title={description}>
      <p className="text-sm font-medium text-neutral-600 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
    </Card>
  );
}

function CircuitStateBadge({ state }: { state: string }) {
  const s = state.toLowerCase();
  const isOpen = s === 'open';
  const isHalf = s.includes('half');
  const className = isOpen
    ? 'bg-red-50 text-red-800 border-red-200'
    : isHalf
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-green-50 text-green-800 border-green-200';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded border text-xs font-medium ${className}`}>
      {state}
    </span>
  );
}
