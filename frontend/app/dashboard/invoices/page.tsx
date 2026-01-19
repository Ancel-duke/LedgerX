'use client';

import { useQuery } from '@tanstack/react-query';
import { invoicesService } from '@/services/api/invoices.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function InvoicesPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesService.getAll({ page: 1, limit: 50 }),
  });

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

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          message="Failed to load invoices. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const invoices = data?.data || [];

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Invoices</h1>
        <Button onClick={() => router.push('/dashboard/invoices/new')}>New Invoice</Button>
      </div>

      {invoices.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No invoices yet"
            description="Create your first invoice to start managing your finances."
            action={{
              label: 'Create Invoice',
              onClick: () => router.push('/dashboard/invoices/new'),
            }}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice: any) => (
            <Link key={invoice.id} href={`/dashboard/invoices/${invoice.id}`}>
              <Card className="p-4 hover:border-neutral-400 transition-colors cursor-pointer">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="font-medium text-neutral-900 truncate">
                        {invoice.invoiceNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getStatusColor(
                          invoice.status,
                        )}`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 mb-1">
                      {invoice.client?.name || 'Unknown Client'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Due: {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    {(() => {
                      const totalPaid = invoice.payments?.reduce(
                        (sum: number, payment: any) => 
                          sum + (payment.status === 'COMPLETED' ? Number(payment.amount || 0) : 0),
                        0,
                      ) || 0;
                      const remaining = Number(invoice.total || 0) - totalPaid;
                      const isPaid = invoice.status === 'PAID' || remaining <= 0;
                      
                      return (
                        <>
                          <p className="font-semibold text-neutral-900 text-lg">
                            ${Number(invoice.total).toFixed(2)}
                          </p>
                          {totalPaid > 0 && (
                            <p className="text-xs text-neutral-600">
                              Paid: ${totalPaid.toFixed(2)}
                            </p>
                          )}
                          {!isPaid && remaining > 0 && (
                            <p className="text-xs font-medium text-orange-600">
                              Balance: ${remaining.toFixed(2)}
                            </p>
                          )}
                          {isPaid && (
                            <p className="text-xs font-medium text-green-600">
                              Fully Paid
                            </p>
                          )}
                          <p className="text-xs text-neutral-500">{invoice.currency || 'USD'}</p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
