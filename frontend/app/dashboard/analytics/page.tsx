'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/api/analytics.service';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorState } from '@/components/ui/error-state';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { InvoiceStatusChart } from '@/components/charts/invoice-status-chart';
import { PaymentCompletionChart } from '@/components/charts/payment-completion-chart';
import { paymentsService } from '@/services/api/payments.service';

export default function AnalyticsPage() {
  const { data: statsResponse, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => analyticsService.getDashboardStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['analytics', 'revenue'],
    queryFn: () => analyticsService.getRevenueByPeriod({ period: 'month' }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: invoiceStatusData } = useQuery({
    queryKey: ['analytics', 'invoice-status'],
    queryFn: () => analyticsService.getInvoiceStatusDistribution(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['payments', 'analytics'],
    queryFn: () => paymentsService.getAll({ limit: 1000 }),
  });

  const paymentStatusData = paymentsData?.data
    ? {
        data: Object.entries(
          paymentsData.data.reduce((acc: Record<string, number>, payment: any) => {
            acc[payment.status] = (acc[payment.status] || 0) + 1;
            return acc;
          }, {}),
        ).map(([status, count]) => ({ status, count })),
      }
    : { data: [] };

  if (statsLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          message="Failed to load analytics. Please try again."
          onRetry={() => refetchStats()}
        />
      </div>
    );
  }

  // The service already unwraps response.data.data, so statsResponse is the direct stats object
  const stats = statsResponse || {};

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h3 className="text-sm font-medium text-neutral-600 mb-2">Total Revenue</h3>
          <p className="text-2xl sm:text-3xl font-bold text-neutral-900">
            ${Number(stats.totalRevenue || 0).toLocaleString()}
          </p>
        </Card>
        <Card className="p-4 sm:p-6">
          <h3 className="text-sm font-medium text-neutral-600 mb-2">Total Invoices</h3>
          <p className="text-2xl sm:text-3xl font-bold text-neutral-900">{stats.totalInvoices || 0}</p>
        </Card>
        <Card className="p-4 sm:p-6">
          <h3 className="text-sm font-medium text-neutral-600 mb-2">Pending Invoices</h3>
          <p className="text-2xl sm:text-3xl font-bold text-neutral-900">
            {stats.pendingInvoices || 0}
          </p>
        </Card>
        <Card className="p-4 sm:p-6">
          <h3 className="text-sm font-medium text-neutral-600 mb-2">Overdue Invoices</h3>
          <p className="text-2xl sm:text-3xl font-bold text-neutral-900">
            {stats.overdueInvoices || 0}
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Revenue Trends</h2>
          {revenueLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : revenueData && Array.isArray(revenueData) && revenueData.length > 0 ? (
            <RevenueChart data={revenueData} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-neutral-500">
              No revenue data available
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Invoice Status</h2>
          {invoiceStatusData && Array.isArray(invoiceStatusData) && invoiceStatusData.length > 0 ? (
            <InvoiceStatusChart data={invoiceStatusData} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-neutral-500">
              No invoice data available
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Payment Completion Rates</h2>
        {paymentStatusData?.data && paymentStatusData.data.length > 0 ? (
          <PaymentCompletionChart data={paymentStatusData.data} />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-neutral-500">
            No payment data available
          </div>
        )}
      </Card>
    </div>
  );
}
