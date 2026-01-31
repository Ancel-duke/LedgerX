'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditComplianceService } from '@/services/api/audit-compliance.service';
import { useAuth } from '@/lib/auth/auth-provider';

export default function AuditPage() {
  const { user } = useAuth();
  const [entityType, setEntityType] = useState('PAYMENT');
  const [entityId, setEntityId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const canAccess = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const entityHistoryQuery = useQuery({
    queryKey: ['audit', 'entity', entityType, entityId],
    queryFn: () => auditComplianceService.getEntityAuditHistory(entityType, entityId),
    enabled: canAccess === true && Boolean(entityId.trim()),
  });

  const exportQuery = useQuery({
    queryKey: ['audit', 'export', fromDate, toDate],
    queryFn: () => auditComplianceService.getTimeRangeExport(fromDate, toDate),
    enabled: canAccess === true && Boolean(fromDate && toDate),
  });

  if (user && !canAccess) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900 mb-2">Audit & Compliance</h1>
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <p className="font-medium">Not authorized</p>
          <p className="text-sm mt-1">You need admin or compliance (manager) role to view audit data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900 mb-2">Audit & Compliance</h1>
      <p className="text-sm text-neutral-600 mb-6">
        Entity audit history and time-range export for compliance.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Entity audit history</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-md text-sm"
            aria-label="Entity type"
          >
            <option value="PAYMENT">PAYMENT</option>
            <option value="LEDGER_TRANSACTION">LEDGER_TRANSACTION</option>
            <option value="INVOICE">INVOICE</option>
          </select>
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Entity ID"
            className="px-3 py-2 border border-neutral-300 rounded-md text-sm min-w-[200px]"
            aria-label="Entity ID"
          />
        </div>
        {entityHistoryQuery.data && (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {entityHistoryQuery.data.data.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-sm text-neutral-900">{r.eventType}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{r.actor}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{new Date(r.occurredAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {entityHistoryQuery.isError && (
          <p className="text-sm text-red-600">Failed to load audit history. You may not have access.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-neutral-800 mb-4">Time-range export</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-md text-sm"
            aria-label="From date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-md text-sm"
            aria-label="To date"
          />
        </div>
        {exportQuery.data && (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {exportQuery.data.data.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-sm text-neutral-900">{r.eventType}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{r.entityType}/{r.entityId}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{new Date(r.occurredAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {exportQuery.isError && (
          <p className="text-sm text-red-600">Failed to load export. You may not have access.</p>
        )}
      </section>
    </div>
  );
}
