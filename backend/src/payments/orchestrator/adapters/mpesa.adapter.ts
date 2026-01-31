import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentMethod } from '@prisma/client';
import { MpesaAdapter as IMpesaAdapter } from '../interfaces/mpesa-adapter.interface';
import { ParsedWebhookPayload } from '../types/parsed-webhook-payload';

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * M-Pesa webhook adapter. Verifies HMAC signature and parses callback payload.
 * Configure MPESA_WEBHOOK_SECRET in env; signature expected in X-Mpesa-Signature header.
 */
@Injectable()
export class MpesaAdapter implements IMpesaAdapter {
  private readonly secret: string;

  constructor() {
    this.secret = process.env.MPESA_WEBHOOK_SECRET || '';
  }

  verifySignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    headers: Record<string, string>,
  ): boolean {
    if (!this.secret || !signatureHeader) {
      return false;
    }
    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex');
    return signatureHeader === expected || signatureHeader === `sha256=${expected}`;
  }

  parsePayload(rawBody: Buffer): ParsedWebhookPayload {
    const body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    const organizationId = (body.OrganizationId ?? body.organizationId ?? body.OrganizationID) as string | undefined;
    const providerRef = (body.TransactionID ?? body.TransactionId ?? body.CheckoutRequestID ?? body.MpesaReceiptNumber ?? body.id) as string | undefined;
    const resultParams = body.Result && typeof body.Result === 'object' && 'ResultParameters' in body.Result
      ? (body.Result as { ResultParameters?: Array<{ Key?: string; Value?: unknown }> }).ResultParameters
      : undefined;
    const amountParam = resultParams?.find((p: { Key?: string }) => p.Key === 'TransactionAmount');
    const amount = Number(amountParam?.Value ?? body.amount ?? body.Amount ?? 0);
    const currency = (body.currency ?? body.Currency ?? 'KES') as string;
    const invoiceId = (body.InvoiceId ?? body.invoiceId ?? (body.metadata && typeof body.metadata === 'object' && 'invoiceId' in body.metadata ? (body.metadata as { invoiceId?: string }).invoiceId : undefined)) as string | undefined;
    const rawTs = body.Timestamp ?? body.timestamp;
    const timestamp = rawTs != null ? (typeof rawTs === 'number' ? rawTs : parseInt(String(rawTs), 10)) : undefined;

    if (!organizationId || !providerRef) {
      throw new Error('M-Pesa payload missing organizationId or providerRef');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('M-Pesa payload invalid amount');
    }

    return {
      organizationId: String(organizationId),
      providerRef: String(providerRef),
      amount,
      currency: String(currency),
      invoiceId: invoiceId ? String(invoiceId) : undefined,
      method: PaymentMethod.BANK_TRANSFER,
      timestamp: typeof timestamp === 'number' && !Number.isNaN(timestamp) ? timestamp : undefined,
      metadata: (body.metadata ?? body.Metadata) as Record<string, unknown> | undefined,
    };
  }

  getTimestampToleranceMs(): number {
    const env = process.env.MPESA_WEBHOOK_TOLERANCE_MS;
    return env ? parseInt(env, 10) : DEFAULT_TOLERANCE_MS;
  }
}
