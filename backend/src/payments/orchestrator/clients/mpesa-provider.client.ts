import { Injectable } from '@nestjs/common';
import { CircuitBreakerService } from '../../../common/circuit-breaker/circuit-breaker.service';
import { StructuredLoggerService } from '../../../common/structured-logger/structured-logger.service';

const CIRCUIT_KEY_MPESA = 'mpesa';

/** Default timeout for OAuth and STK Push HTTP calls (ms). */
const DEFAULT_MPESA_TIMEOUT_MS = 15000;

export interface MpesaStkPushParams {
  amount: number;
  phoneNumber: string;
  accountReference: string;
  transactionDesc?: string;
  organizationId?: string;
  metadata?: Record<string, string>;
}

/** Safaricom OAuth response. */
interface MpesaOAuthResponse {
  access_token: string;
  expires_in: string;
}

/** Safaricom STK Push processrequest response (API may return camelCase or other). */
interface MpesaStkPushApiResponse {
  CheckoutRequestID?: string;
  checkoutRequestID?: string;
  ResponseDescription?: string;
  responseDescription?: string;
  errorCode?: string;
  MerchantRequestID?: string;
  merchantRequestID?: string;
}

/** In-memory OAuth token cache (no secrets in logs). */
interface TokenCache {
  accessToken: string;
  expiresAt: number;
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
  private readonly shortCode: string;
  private readonly passkey: string;
  private readonly callbackUrl: string;
  private readonly timeoutMs: number;
  private tokenCache: TokenCache | null = null;
  private readonly logger = new StructuredLoggerService(MpesaProviderClient.name);

  constructor(private readonly circuitBreaker: CircuitBreakerService) {
    this.baseUrl = (process.env.MPESA_API_BASE_URL ?? 'https://sandbox.safaricom.co.ke').replace(/\/$/, '');
    this.consumerKey = process.env.MPESA_CONSUMER_KEY ?? '';
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET ?? '';
    this.shortCode = process.env.MPESA_SHORTCODE ?? '';
    this.passkey = process.env.MPESA_PASSKEY ?? '';
    this.callbackUrl = process.env.MPESA_CALLBACK_URL ?? '';
    const timeout = process.env.MPESA_STK_PUSH_TIMEOUT_MS;
    this.timeoutMs = timeout ? parseInt(timeout, 10) : DEFAULT_MPESA_TIMEOUT_MS;
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
   * Get OAuth access token (cached until near expiry). Never log the token.
   */
  private async getOAuthToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60_000) {
      return this.tokenCache.accessToken;
    }
    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`, 'utf8').toString('base64');
    const url = `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn('M-Pesa OAuth failed', { status: res.status, statusText: res.statusText });
        throw new Error(`M-Pesa OAuth failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as MpesaOAuthResponse;
      if (!data?.access_token) {
        throw new Error('M-Pesa OAuth response missing access_token');
      }
      const expiresInSec = parseInt(data.expires_in, 10) || 3600;
      this.tokenCache = {
        accessToken: data.access_token,
        expiresAt: now + (expiresInSec - 60) * 1000,
      };
      return this.tokenCache.accessToken;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('M-Pesa OAuth request timed out');
        }
        throw err;
      }
      throw err;
    }
  }

  /**
   * Normalize Kenyan phone to 254XXXXXXXXX.
   */
  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('254')) return digits;
    if (digits.startsWith('0')) return '254' + digits.slice(1);
    if (digits.length === 9) return '254' + digits;
    return '254' + digits;
  }

  /**
   * Initiate STK push (outbound). Real Safaricom Daraja API: OAuth + POST processrequest.
   * Wrapped in circuit; timeout and errors do not trigger retries.
   */
  async initiateStkPush(params: MpesaStkPushParams): Promise<{ checkoutRequestID: string; responseDescription: string }> {
    return this.execute(async () => {
      if (!this.consumerKey || !this.consumerSecret) {
        throw new Error('M-Pesa is not configured (missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET)');
      }
      if (!this.shortCode || !this.passkey || !this.callbackUrl) {
        throw new Error('M-Pesa STK Push is not configured (missing MPESA_SHORTCODE, MPESA_PASSKEY, or MPESA_CALLBACK_URL)');
      }
      const token = await this.getOAuthToken();
      const timestamp = this.formatTimestamp();
      const password = Buffer.from(this.shortCode + this.passkey + timestamp, 'utf8').toString('base64');
      const phone = this.normalizePhone(params.phoneNumber);
      const amount = Math.floor(params.amount);
      if (amount < 1) {
        throw new Error('M-Pesa STK Push amount must be at least 1');
      }
      const body = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: this.shortCode,
        PhoneNumber: phone,
        CallBackURL: this.callbackUrl,
        AccountReference: params.accountReference.slice(0, 12),
        TransactionDesc: (params.transactionDesc ?? 'Payment').slice(0, 13),
      };
      const url = `${this.baseUrl}/mpesa/stkpush/v1/processrequest`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const json = (await res.json()) as MpesaStkPushApiResponse;
        const checkoutRequestID =
          json.CheckoutRequestID ?? json.checkoutRequestID ?? '';
        const responseDescription =
          json.ResponseDescription ?? json.responseDescription ?? (res.ok ? 'Success' : 'Unknown error');
        if (!res.ok) {
          this.logger.warn('M-Pesa STK Push request failed', {
            status: res.status,
            errorCode: json.errorCode,
            responseDescription,
          });
          throw new Error(`M-Pesa STK Push failed: ${responseDescription} (${json.errorCode ?? res.status})`);
        }
        if (!checkoutRequestID) {
          throw new Error('M-Pesa STK Push response missing CheckoutRequestID');
        }
        return {
          checkoutRequestID,
          responseDescription,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            throw new Error('M-Pesa STK Push request timed out');
          }
          throw err;
        }
        throw err;
      }
    });
  }

  private formatTimestamp(): string {
    const d = new Date();
    const y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}${M}${D}${h}${m}${s}`;
  }
}
