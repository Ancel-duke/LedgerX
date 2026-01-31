'use client';

import { useQuery } from '@tanstack/react-query';
import { clientsService } from '@/services/api/clients.service';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ClientsPage() {
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsService.getAll({ page: 1, limit: 50 }),
  });

  const clients = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Loading clients…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">Failed to load clients.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Clients</h1>
        <button
          type="button"
          onClick={() => router.push('/dashboard/clients/new')}
          className="px-4 py-2 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800"
        >
          New Client
        </button>
      </div>
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Phone</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {Array.isArray(clients) && clients.length ? (
              clients.map((c: { id: string; name: string; email?: string; phone?: string }) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-sm text-neutral-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/clients/${c.id}/edit`} className="text-blue-600 hover:underline text-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500 text-sm">
                  No clients yet. <Link href="/dashboard/clients/new" className="text-blue-600 hover:underline">Add one</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
