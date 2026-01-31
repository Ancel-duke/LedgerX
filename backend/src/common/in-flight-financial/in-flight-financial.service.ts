import { Injectable } from '@nestjs/common';

/**
 * Tracks in-flight financial operations (payments, ledger posts).
 * Restart remediation must not run while count > 0.
 */
@Injectable()
export class InFlightFinancialService {
  private count = 0;

  /** Call at start of a financial operation; call release() in finally. */
  start(): () => void {
    this.count += 1;
    return () => {
      this.count = Math.max(0, this.count - 1);
    };
  }

  getCount(): number {
    return this.count;
  }

  /** True if any financial operation is in progress. */
  hasInFlight(): boolean {
    return this.count > 0;
  }
}
