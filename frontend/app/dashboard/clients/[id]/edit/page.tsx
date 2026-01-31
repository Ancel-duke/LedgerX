'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsService } from '@/services/api/clients.service';
import { useToast } from '@/lib/toast-context';

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const id = params?.id as string;

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientsService.getById(id),
    enabled: !!id,
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (client) {
      setName((client as { name: string }).name ?? '');
      setEmail((client as { email?: string }).email ?? '');
      setPhone((client as { phone?: string }).phone ?? '');
    }
  }, [client]);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; email?: string; phone?: string }) =>
      clientsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      addToast('Client updated.', 'success');
      router.push('/dashboard/clients');
    },
    onError: () => addToast('Failed to update client.', 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateMutation.mutate({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined });
  };

  if (isLoading || !client) {
    return (
      <div className="p-6">
        <p className="text-neutral-600">Loading client…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <Link href="/dashboard/clients" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Clients
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Edit Client</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </button>
          <Link href="/dashboard/clients" className="px-4 py-2 border border-neutral-300 rounded-md text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
