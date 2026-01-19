'use client';

import { useQuery } from '@tanstack/react-query';
import { invoicesService } from '@/services/api/invoices.service';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import Link from 'next/link';

export function InvoiceList() {
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', 'recent'],
    queryFn: () => invoicesService.getAll({ page: 1, limit: 5 }),
    refetchInterval: 15000, // Refresh every 15 seconds for real-time updates
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-neutral-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const invoices = data?.data || [];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-neutral-200 text-neutral-700',
      SENT: 'bg-neutral-300 text-neutral-800',
      PAID: 'bg-neutral-800 text-white',
      OVERDUE: 'bg-neutral-700 text-white',
      CANCELLED: 'bg-neutral-400 text-white',
    };
    return colors[status] || 'bg-neutral-200 text-neutral-700';
  };

  return (
    <div className="space-y-3">
      {invoices.length === 0 ? (
        <p className="text-sm text-neutral-600 py-4 text-center">No invoices yet</p>
      ) : (
        invoices.map((invoice: any) => (
          <Link key={invoice.id} href={`/dashboard/invoices/${invoice.id}`}>
            <Card className="p-4 hover:border-neutral-400 transition-colors cursor-pointer">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium text-neutral-900">{invoice.invoiceNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                        invoice.status,
                      )}`}
                    >
                      {invoice.status}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600">
                    {invoice.client?.name || 'Unknown Client'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Due: {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-neutral-900">${Number(invoice.total).toFixed(2)}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))
      )}
      {invoices.length > 0 && (
        <Link
          href="/dashboard/invoices"
          className="block text-center text-sm text-neutral-600 hover:text-neutral-900 mt-4"
        >
          View all invoices →
        </Link>
      )}
    </div>
  );
}
