'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { invoicesService } from '@/services/api/invoices.service';
import { format } from 'date-fns';

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesService.getById(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6"><p className="text-neutral-600">Loading…</p></div>;
  if (error || !invoice) return <div className="p-6"><p className="text-red-600 mb-4">Invoice not found.</p><Link href="/dashboard/invoices" className="text-blue-600 hover:underline">Back to Invoices</Link></div>;

  const inv = invoice as { invoiceNumber: string; client?: { name: string; email?: string }; clientId: string; issueDate: string; dueDate: string; status: string; subtotal: number; taxRate: number; taxAmount: number; total: number; currency: string; notes?: string; items?: Array<{ description: string; quantity: number; unitPrice: number; total: number }> };
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/dashboard/invoices" className="text-sm text-blue-600 hover:underline mb-4 inline-block">← Back to Invoices</Link>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Invoice {inv.invoiceNumber}</h1>
      <p className="text-sm text-neutral-600 mb-6">{inv.client?.name ?? inv.clientId} · {format(new Date(inv.issueDate), 'PPP')} – {format(new Date(inv.dueDate), 'PPP')}</p>
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <p className="text-sm text-neutral-700">Status: {inv.status}</p>
        {inv.items?.length ? <table className="min-w-full mt-4"><thead><tr><th className="text-left text-xs font-medium text-neutral-600">Description</th><th className="text-right text-xs font-medium text-neutral-600">Qty</th><th className="text-right text-xs font-medium text-neutral-600">Total</th></tr></thead><tbody>{inv.items.map((item, i) => <tr key={i}><td className="py-2 text-sm">{item.description}</td><td className="text-right text-sm">{item.quantity}</td><td className="text-right text-sm">{item.total}</td></tr>)}</tbody></table> : null}
        <p className="mt-4 text-sm font-semibold">Total: {inv.currency} {inv.total}</p>
        {inv.notes && <p className="mt-2 text-sm text-neutral-600">{inv.notes}</p>}
      </div>
    </div>
  );
}
