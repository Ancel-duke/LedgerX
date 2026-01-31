import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { MetricsService } from '../../metrics/metrics.service';

const START_AT = 'observability_start_at';

/**
 * Records request latency and, on error, auth/payment failure metrics.
 * Does not auto-retry financial operations.
 */
@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const startAt = Date.now();
    (req as Request & { [START_AT]: number })[START_AT] = startAt;

    const method = req.method;
    const path = req.route?.path ?? req.path ?? req.url ?? '';

    return next.handle().pipe(
      tap(() => {
        const status = context.switchToHttp().getResponse().statusCode;
        const duration = (Date.now() - startAt) / 1000;
        this.metricsService.recordRequestDuration(method, path, status, duration);
      }),
      catchError((err) => {
        const status =
          err instanceof HttpException ? err.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        const duration = (Date.now() - startAt) / 1000;
        this.metricsService.recordRequestDuration(method, path, status, duration);

        if (err?.status === HttpStatus.UNAUTHORIZED || err?.getStatus?.() === HttpStatus.UNAUTHORIZED) {
          this.metricsService.recordAuthFailure('unauthorized');
        }
        const pathLower = (path || req.url || '').toLowerCase();
        if (pathLower.includes('payment') && status >= 400) {
          this.metricsService.recordPaymentFailure('request');
        }

        throw err;
      }),
    );
  }
}
