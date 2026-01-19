'use client';

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsService } from '@/services/api/payments.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PaymentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentsService.getAll({ page: 1, limit: 50 }),
  });

  // Refresh data periodically or on focus
  React.useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [queryClient]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-neutral-200 text-neutral-700',
      COMPLETED: 'bg-neutral-800 text-white',
      FAILED: 'bg-neutral-600 text-white',
      REFUNDED: 'bg-neutral-400 text-white',
    };
    return colors[status] || 'bg-neutral-200 text-neutral-700';
  };

  const getMethodLabel = (method: string) => {
    return method
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
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
          message="Failed to load payments. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const payments = data?.data || [];

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Payments</h1>
        <Button onClick={() => router.push('/dashboard/payments/new')}>New Payment</Button>
      </div>

      {payments.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No payments yet"
            description="Start tracking payments by creating your first payment record."
            action={{
              label: 'Create Payment',
              onClick: () => router.push('/dashboard/payments/new'),
            }}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {payments.map((payment: any) => (
            <Link key={payment.id} href={`/dashboard/payments/${payment.id}`}>
              <Card className="p-4 hover:border-neutral-400 transition-colors cursor-pointer">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="font-medium text-neutral-900 truncate">
                        {payment.invoice?.invoiceNumber || 'Standalone Payment'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getStatusColor(
                          payment.status,
                        )}`}
                      >
                        {payment.status}
                      </span>
                      {payment.invoice && payment.status === 'COMPLETED' && (
                        <span className="text-xs text-neutral-500">
                          {(() => {
                            // This would ideally come from the backend, but for now we'll show it
                            return 'Paid';
                          })()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 mb-1">{getMethodLabel(payment.method)}</p>
                    {payment.processedAt && (
                      <p className="text-xs text-neutral-500">
                        {format(new Date(payment.processedAt), 'MMM dd, yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold text-neutral-900 text-lg">
                      ${Number(payment.amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-neutral-500">{payment.currency || 'USD'}</p>
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
