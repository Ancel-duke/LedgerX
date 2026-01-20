'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/api/analytics.service';
import { paymentsService } from '@/services/api/payments.service';
import { activityLogService } from '@/services/api/activity-log.service';
import { Card } from '@/components/ui/card';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { InvoiceStatusChart } from '@/components/charts/invoice-status-chart';
import { PaymentCompletionChart } from '@/components/charts/payment-completion-chart';
import { InvoiceList } from '@/components/dashboard/invoice-list';
import { PaymentList } from '@/components/dashboard/payment-list';
import { ActivityTimeline } from '@/components/dashboard/activity-timeline';

export default function DashboardPage() {
  // Real-time analytics queries with auto-refresh
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => analyticsService.getDashboardStats(),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['analytics', 'revenue'],
    queryFn: () => analyticsService.getRevenueByPeriod({ period: 'month' }),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const { data: invoiceStatusData } = useQuery({
    queryKey: ['analytics', 'invoice-status'],
    queryFn: () => analyticsService.getInvoiceStatusDistribution(),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['payments', 'all'],
    queryFn: () => paymentsService.getAll({ limit: 1000 }),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Real-time activity log query
  const { data: activitiesData } = useQuery({
    queryKey: ['activity-log', 'dashboard'],
    queryFn: () => activityLogService.getAll({ page: 1, limit: 10 }),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Aggregate payment status data for the chart
  interface PaymentStatusData {
    status: string;
    count: number;
  }

  const paymentStatusData: { data: PaymentStatusData[] } = paymentsData?.data
    ? {
        data: Object.entries(
          paymentsData.data.reduce((acc: Record<string, number>, payment: any) => {
            acc[payment.status] = (acc[payment.status] || 0) + 1;
            return acc;
          }, {}),
        ).map(([status, count]): PaymentStatusData => ({ 
          status, 
          count: count as number 
        })),
      }
    : { data: [] };

  // The service already unwraps response.data.data, so stats is the direct stats object
  const statsData = stats || {
    totalInvoices: 0,
    totalRevenue: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
  };

  // Get activities for ActivityTimeline
  const activities = activitiesData?.data || [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Dashboard</h1>
        <p className="text-neutral-600">Overview of your finance management</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-neutral-600">Total Invoices</h3>
            <span className="text-2xl">📄</span>
          </div>
          {statsLoading ? (
            <div className="h-8 bg-neutral-100 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-neutral-900">{statsData.totalInvoices}</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-neutral-600">Total Revenue</h3>
            <span className="text-2xl">💰</span>
          </div>
          {statsLoading ? (
            <div className="h-8 bg-neutral-100 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-neutral-900">
              ${Number(statsData.totalRevenue || 0).toLocaleString()}
            </p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-neutral-600">Pending Invoices</h3>
            <span className="text-2xl">⏳</span>
          </div>
          {statsLoading ? (
            <div className="h-8 bg-neutral-100 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-neutral-900">{statsData.pendingInvoices}</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-neutral-600">Overdue Invoices</h3>
            <span className="text-2xl">⚠️</span>
          </div>
          {statsLoading ? (
            <div className="h-8 bg-neutral-100 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-neutral-900">{statsData.overdueInvoices}</p>
          )}
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue Trends */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Revenue Trends</h2>
          {revenueLoading ? (
            <div className="h-[300px] bg-neutral-100 rounded animate-pulse" />
          ) : revenueData && Array.isArray(revenueData) && revenueData.length > 0 ? (
            <RevenueChart data={revenueData} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-neutral-500">
              No revenue data available
            </div>
          )}
        </Card>

        {/* Invoice Status Distribution */}
        <Card className="p-6">
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

      {/* Payment Completion Chart */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Payment Completion Rates</h2>
        {paymentStatusData?.data && paymentStatusData.data.length > 0 ? (
          <PaymentCompletionChart data={paymentStatusData.data} />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-neutral-500">
            No payment data available
          </div>
        )}
      </Card>

      {/* Invoice Management & Payment Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Invoice Management */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">Recent Invoices</h2>
          </div>
          <InvoiceList />
        </Card>

        {/* Payment Tracking */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">Recent Payments</h2>
          </div>
          <PaymentList />
        </Card>
      </div>

      {/* Activity Log Timeline */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Activity Log</h2>
        </div>
        <ActivityTimeline activities={activities} />
      </Card>
    </div>
  );
}
