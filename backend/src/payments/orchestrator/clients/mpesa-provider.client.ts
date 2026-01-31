import { Injectable } from '@nestjs/common';
import { CircuitBreakerService } from '../../../common/circuit-breaker/circuit-breaker.service';

const CIRCUIT_KEY_MPESA = 'mpesa';

export interface MpesaStkPushParams {
  amount: number;
  phoneNumber: string;
  accountReference: string;
  transactionDesc?: string;
  organizationId?: string;
  metadata?: Record<string, string>;
}

/**
 * All outbound M-Pesa API calls MUST go through this client so they are
 * protected by the circuit breaker. Do NOT call M-Pesa HTTP API directly elsewhere.
 * Webhook/callback handling (MpesaAdapter) is inbound and unchanged.
 */
@Injectable()
export class MpesaProviderClient {
  private readonly baseUrl: string;
  private readonly consumerKey: string;
  private readonly consumerSecret: string;

  constructor(private readonly circuitBreaker: CircuitBreakerService) {
    this.baseUrl = process.env.MPESA_API_BASE_URL ?? 'https://sandbox.safaricom.co.ke';
    this.consumerKey = process.env.MPESA_CONSUMER_KEY ?? '';
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET ?? '';
  }

  /**
   * Execute any outbound M-Pesa API call through the circuit breaker.
   * Use for STK push, B2C, etc. Fails fast with ProviderUnavailableException when circuit is open; no retry.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(
      CIRCUIT_KEY_MPESA,
      fn,
      { name: 'mpesa' },
    );
  }

  /**
   * Initiate STK push (outbound). Wrapped in circuit.
   * Implement actual M-Pesa STK push API call inside execute(); this is the entry point.
   */
  async initiateStkPush(params: MpesaStkPushParams): Promise<{ checkoutRequestID: string; responseDescription: string }> {
    return this.execute(async () => {
      if (!this.consumerKey || !this.consumerSecret) {
        throw new Error('M-Pesa is not configured (missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET)');
      }
      // Placeholder: replace with actual M-Pesa STK push HTTP call (oauth token + post to mpesa/stkpush/v1/processrequest).
      // Example: const token = await this.getOAuthToken(); const res = await axios.post(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, body, { headers: { Authorization: `Bearer ${token}` } });
      const checkoutRequestID = `ws_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return {
        checkoutRequestID,
        responseDescription: 'Success. Request accepted for processing',
      };
    });
  }
}
