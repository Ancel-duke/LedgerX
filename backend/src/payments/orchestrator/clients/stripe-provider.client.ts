import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { CircuitBreakerService } from '../../../common/circuit-breaker/circuit-breaker.service';

const CIRCUIT_KEY_STRIPE = 'stripe';

/**
 * All outbound Stripe API calls MUST go through this client so they are
 * protected by the circuit breaker. Do NOT call stripe.* directly elsewhere.
 * Webhook verification (StripeAdapter) is inbound and unchanged.
 */
@Injectable()
export class StripeProviderClient {
  private readonly stripe: Stripe | null = null;

  constructor(private readonly circuitBreaker: CircuitBreakerService) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2024-11-20.acacia' });
    }
  }

  /**
   * Execute any outbound Stripe API call through the circuit breaker.
   * Use for all stripe.* calls (paymentIntents, customers, etc.).
   * Fails fast with ProviderUnavailableException when circuit is open; no retry.
   */
  async execute<T>(fn: (stripe: Stripe) => Promise<T>): Promise<T> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY)');
    }
    return this.circuitBreaker.execute(
      CIRCUIT_KEY_STRIPE,
      () => fn(this.stripe!),
      { name: 'stripe' },
    );
  }

  /** Create a PaymentIntent (outbound). Wrap in circuit. */
  async createPaymentIntent(
    params: Stripe.PaymentIntentCreateParams,
  ): Promise<Stripe.PaymentIntent> {
    return this.execute((stripe) => stripe.paymentIntents.create(params));
  }

  /** Retrieve a PaymentIntent (outbound). Wrap in circuit. */
  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.execute((stripe) => stripe.paymentIntents.retrieve(id));
  }

  /** Cancel a PaymentIntent (outbound). Wrap in circuit. */
  async cancelPaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.execute((stripe) => stripe.paymentIntents.cancel(id));
  }
}
