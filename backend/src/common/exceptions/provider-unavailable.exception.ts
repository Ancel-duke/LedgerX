import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when a provider (Stripe, M-Pesa) is unavailable due to circuit breaker open.
 * Fail fast; do NOT retry financial operations.
 */
export class ProviderUnavailableException extends HttpException {
  constructor(
    public readonly provider: string,
    message?: string,
  ) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Provider Unavailable',
        message: message ?? `Payment provider ${provider} is temporarily unavailable. Please try again later.`,
        provider,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
