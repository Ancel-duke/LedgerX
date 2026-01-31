'use client';

import { useAuth } from '@/lib/auth/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { organizationsService } from '@/services/api/organizations.service';
import { diagnosticsService } from '@/services/api/diagnostics.service';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, organization } = useAuth();

  const orgQuery = useQuery({
    queryKey: ['organization', organization?.id],
    queryFn: () => organizationsService.getById(organization!.id),
    enabled: !!organization?.id,
  });
  const flagsQuery = useQuery({
    queryKey: ['diagnostics', 'feature-flags', 'rows'],
    queryFn: () => diagnosticsService.getFeatureFlagRows(),
  });

  const org = orgQuery.data;
  const flags = flagsQuery.data ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-6">Settings</h1>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">User Profile</h2>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <p className="text-sm text-neutral-600">
            <span className="font-medium text-neutral-800">Name:</span> {user?.firstName} {user?.lastName}
          </p>
          <p className="text-sm text-neutral-600 mt-1">
            <span className="font-medium text-neutral-800">Email:</span> {user?.email}
          </p>
          <p className="text-sm text-neutral-600 mt-1">
            <span className="font-medium text-neutral-800">Role:</span> {user?.role}
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Organization Profile</h2>
        {orgQuery.isLoading ? (
          <p className="text-neutral-600 text-sm">Loading…</p>
        ) : org ? (
          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-800">Name:</span> {org.name}
            </p>
            <p className="text-sm text-neutral-600 mt-1">
              <span className="font-medium text-neutral-800">Slug:</span> {org.slug}
            </p>
            {org.email && (
              <p className="text-sm text-neutral-600 mt-1">
                <span className="font-medium text-neutral-800">Email:</span> {org.email}
              </p>
            )}
            {org.phone && (
              <p className="text-sm text-neutral-600 mt-1">
                <span className="font-medium text-neutral-800">Phone:</span> {org.phone}
              </p>
            )}
          </div>
        ) : (
          <p className="text-neutral-500 text-sm">No organization data.</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Feature Flags (read-only)</h2>
        <p className="text-sm text-neutral-600 mb-2">
          Non-financial toggles; managed via Diagnostics remediations.
        </p>
        {flags.length ? (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Scope</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {flags.map((f) => (
                  <tr key={`${f.key}-${f.scope}-${f.scopeId ?? ''}`}>
                    <td className="px-4 py-3 text-sm text-neutral-900">{f.key}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{f.scope}{f.scopeId ? `: ${f.scopeId}` : ''}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{f.value ? 'true' : 'false'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-sm">No feature flags configured.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Provider Connection Status</h2>
        <p className="text-sm text-neutral-600 mb-2">
          Indicates whether providers are configured (no secrets shown).
        </p>
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-2">
          <p className="text-sm text-neutral-700">
            <span className="font-medium">Stripe:</span> Configured via backend env (STRIPE_SECRET_KEY).
          </p>
          <p className="text-sm text-neutral-700">
            <span className="font-medium">M-Pesa:</span> Configured via backend env (MPESA_CONSUMER_KEY, MPESA_SHORTCODE, etc.).
          </p>
        </div>
      </section>

      <div className="mt-8">
        <Link href="/dashboard/diagnostics" className="text-blue-600 hover:underline text-sm focus:outline-none focus:underline">
          View Diagnostics & Health →
        </Link>
      </div>
    </div>
  );
}
