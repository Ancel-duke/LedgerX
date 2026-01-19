'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsService } from '@/services/api/payments.service';
import { invoicesService } from '@/services/api/invoices.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function NewPaymentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: '',
    currency: 'USD',
    method: 'CREDIT_CARD',
    transactionId: '',
    notes: '',
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesService.getAll({ page: 1, limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      // Ensure status is COMPLETED and processedAt is set
      const paymentData = {
        ...data,
        status: 'COMPLETED', // Always set to COMPLETED
        processedAt: data.processedAt || new Date().toISOString(), // Set processed date
      };
      console.log('Creating payment with data:', paymentData);
      return paymentsService.create(paymentData);
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['activity-log'] });
      router.push('/dashboard/payments');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.transactionId) {
      // Auto-generate transaction ID if not provided
      formData.transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    createMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount),
      status: 'COMPLETED', // Ensure status is COMPLETED
      processedAt: new Date().toISOString(), // Set processed date
    });
  };

  const invoices = invoicesData?.data || [];

  // Calculate remaining balance for an invoice
  const calculateRemainingBalance = (invoice: any) => {
    if (invoice.status === 'PAID') {
      return 0;
    }
    const totalPaid = invoice.payments?.reduce(
      (sum: number, payment: any) => sum + Number(payment.amount || 0),
      0,
    ) || 0;
    const remaining = Number(invoice.total || 0) - totalPaid;
    return Math.max(0, remaining);
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">New Payment</h1>
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Invoice (Optional)
            </label>
            <select
              value={formData.invoiceId}
              onChange={(e) => {
                const selectedInvoice = invoices.find((inv: any) => inv.id === e.target.value);
                setFormData({ 
                  ...formData, 
                  invoiceId: e.target.value,
                  // Auto-fill amount with remaining balance if invoice selected
                  amount: selectedInvoice ? calculateRemainingBalance(selectedInvoice).toString() : formData.amount,
                });
              }}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              <option value="">Standalone Payment</option>
              {invoices.map((invoice: any) => {
                const remaining = calculateRemainingBalance(invoice);
                return (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNumber} - ${Number(invoice.total).toFixed(2)} 
                    {remaining > 0 && remaining < Number(invoice.total) && ` (Remaining: $${remaining.toFixed(2)})`}
                    {remaining === 0 && ' (PAID)'}
                  </option>
                );
              })}
            </select>
            {formData.invoiceId && (() => {
              const selectedInvoice = invoices.find((inv: any) => inv.id === formData.invoiceId);
              if (selectedInvoice) {
                const remaining = calculateRemainingBalance(selectedInvoice);
                return (
                  <p className="mt-1 text-sm text-neutral-600">
                    Invoice Total: ${Number(selectedInvoice.total).toFixed(2)} | 
                    Remaining: ${remaining.toFixed(2)} | 
                    Status: {selectedInvoice.status}
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Amount *
              </label>
              <Input
                required
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Currency
              </label>
              <Input
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                placeholder="USD"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Payment Method *
            </label>
            <select
              required
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHECK">Check</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Transaction ID *
            </label>
            <Input
              required
              value={formData.transactionId}
              onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
              placeholder="TXN-123456"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1"
            >
              {createMutation.isPending ? <LoadingSpinner size="sm" /> : 'Create Payment'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
