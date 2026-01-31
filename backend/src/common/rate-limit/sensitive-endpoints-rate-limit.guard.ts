import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { MetricsService } from '../../metrics/metrics.service';

const INTERNAL_SERVICE_HEADER = 'x-internal-service';

interface Window {
  count: number;
  resetAt: number;
}

/** Per-path limits. Order matters: more specific (webhooks) before generic (payments). */
const PATH_LIMITS: Array<{
  pattern: RegExp;
  name: string;
  ipLimit: number;
  ipTtlMs: number;
  orgLimit: number;
  orgTtlMs: number;
}> = [
  { pattern: /^\/api\/auth\/login$/i, name: 'login', ipLimit: 20, ipTtlMs: 60 * 1000, orgLimit: 0, orgTtlMs: 0 },
  { pattern: /^\/api\/auth\/forgot-password$/i, name: 'forgot-password', ipLimit: 3, ipTtlMs: 15 * 60 * 1000, orgLimit: 0, orgTtlMs: 0 },
  { pattern: /^\/api\/payments\/webhooks\//i, name: 'webhooks', ipLimit: 100, ipTtlMs: 60 * 1000, orgLimit: 500, orgTtlMs: 60 * 1000 },
  { pattern: /^\/api\/payments\//i, name: 'payments', ipLimit: 60, ipTtlMs: 60 * 1000, orgLimit: 200, orgTtlMs: 60 * 1000 },
];

@Injectable()
export class SensitiveEndpointsRateLimitGuard implements CanActivate {
  private readonly store = new Map<string, Window>();

  constructor(
    private readonly metricsService: MetricsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const path = (req.path || req.url || '').split('?')[0];

    if (this.isInternalCall(req)) {
      return true;
    }

    const config = PATH_LIMITS.find((c) => c.pattern.test(path));
    if (!config) {
      return true;
    }

    const now = Date.now();
    const ip = this.getClientIp(req);

    if (config.ipLimit > 0) {
      const ipKey = `ip:${config.name}:${ip}`;
      if (!this.checkAndIncrement(ipKey, config.ipLimit, config.ipTtlMs, now)) {
        this.metricsService.recordRateLimitExceeded('ip');
        throw new HttpException(
          { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too many requests' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const orgId = (req as Request & { user?: { organizationId?: string } }).user?.organizationId;
    if (config.orgLimit > 0 && orgId) {
      const orgKey = `org:${config.name}:${orgId}`;
      if (!this.checkAndIncrement(orgKey, config.orgLimit, config.orgTtlMs, now)) {
        this.metricsService.recordRateLimitExceeded('org');
        throw new HttpException(
          { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too many requests' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }

  private isInternalCall(req: Request): boolean {
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    const header = req.headers[INTERNAL_SERVICE_HEADER];
    if (!secret) return false;
    return header === secret;
  }

  private getClientIp(req: Request): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') {
      return xff.split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? req.ip ?? 'unknown';
  }

  private checkAndIncrement(key: string, limit: number, ttlMs: number, now: number): boolean {
    let w = this.store.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + ttlMs };
      this.store.set(key, w);
    }
    w.count++;
    return w.count <= limit;
  }
}
