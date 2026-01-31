import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentMethod } from '@prisma/client';
import { StripeAdapter as IStripeAdapter } from '../interfaces/stripe-adapter.interface';
import { ParsedWebhookPayload } from '../types/parsed-webhook-payload';

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Stripe webhook adapter. Verifies Stripe-Signature and parses payment_intent.succeeded / charge.succeeded.
 * Configure STRIPE_WEBHOOK_SECRET (whsec_...) in env.
 */
@Injectable()
export class StripeAdapter implements IStripeAdapter {
  private readonly stripe: Stripe | null = null;
  private readonly webhookSecret: string;

  constructor() {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2024-11-20.acacia' });
    }
  }

  verifySignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    _headers: Record<string, string>,
  ): boolean {
    if (!this.webhookSecret || !signatureHeader) {
      return false;
    }
    try {
      Stripe.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);
      return true;
    } catch {
      return false;
    }
  }

  parsePayload(rawBody: Buffer): ParsedWebhookPayload {
    const event = JSON.parse(rawBody.toString('utf8')) as Stripe.Event;
    const type = event.type;
    const obj = event.data?.object as Record<string, unknown> | undefined;
    if (!obj) {
      throw new Error('Stripe event missing data.object');
    }

    let amountCents = 0;
    let currency = 'usd';
    let providerRef = (obj.id as string) || event.id;
    const metadata = (obj.metadata as Record<string, string> | undefined) ?? {};
    const organizationId = metadata.organizationId ?? metadata.organization_id;
    const invoiceId = metadata.invoiceId ?? metadata.invoice_id;

    if (type === 'payment_intent.succeeded') {
      const pi = obj as Stripe.PaymentIntent;
      amountCents = pi.amount ?? 0;
      currency = (pi.currency ?? 'usd') as string;
      providerRef = pi.id;
    } else if (type === 'charge.succeeded') {
      const charge = obj as Stripe.Charge;
      amountCents = charge.amount ?? 0;
      currency = (charge.currency ?? 'usd') as string;
      providerRef = charge.id;
    } else {
      throw new Error(`Unsupported Stripe event type: ${type}`);
    }

    if (!organizationId) {
      throw new Error('Stripe event metadata missing organizationId');
    }
    if (amountCents <= 0) {
      throw new Error('Stripe event invalid amount');
    }

    const amountMajor = amountCents / 100;

    return {
      organizationId: String(organizationId),
      providerRef,
      amount: amountMajor,
      currency: currency.toUpperCase(),
      invoiceId: invoiceId ? String(invoiceId) : undefined,
      method: PaymentMethod.CREDIT_CARD,
      timestamp: typeof event.created === 'number' ? event.created : undefined,
      metadata: metadata as Record<string, unknown>,
    };
  }

  getTimestampToleranceMs(): number {
    const env = process.env.STRIPE_WEBHOOK_TOLERANCE_MS;
    return env ? parseInt(env, 10) : DEFAULT_TOLERANCE_MS;
  }
}
