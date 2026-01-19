'use client';

import { useQuery } from '@tanstack/react-query';
import { paymentsService } from '@/services/api/payments.service';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import Link from 'next/link';

export function PaymentList() {
  const { data, isLoading } = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: () => paymentsService.getAll({ page: 1, limit: 5 }),
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

  const payments = data?.data || [];

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

  return (
    <div className="space-y-3">
      {payments.length === 0 ? (
        <p className="text-sm text-neutral-600 py-4 text-center">No payments yet</p>
      ) : (
        payments.map((payment: any) => (
          <Link key={payment.id} href={`/dashboard/payments/${payment.id}`}>
            <Card className="p-4 hover:border-neutral-400 transition-colors cursor-pointer">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium text-neutral-900">
                      {payment.invoice?.invoiceNumber || 'Standalone Payment'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                        payment.status,
                      )}`}
                    >
                      {payment.status}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600">{getMethodLabel(payment.method)}</p>
                  {payment.processedAt && (
                    <p className="text-xs text-neutral-500 mt-1">
                      {format(new Date(payment.processedAt), 'MMM dd, yyyy')}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-neutral-900">
                    ${Number(payment.amount).toFixed(2)}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))
      )}
      {payments.length > 0 && (
        <Link
          href="/dashboard/payments"
          className="block text-center text-sm text-neutral-600 hover:text-neutral-900 mt-4"
        >
          View all payments →
        </Link>
      )}
    </div>
  );
}
