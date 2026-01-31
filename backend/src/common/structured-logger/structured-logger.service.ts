import { getRequestContext } from '../request-context/request-context';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'secret',
  'apiKey',
  'api_key',
  'cookie',
  'session',
  'creditCard',
  'ssn',
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    if (SENSITIVE_KEYS.has(keyLower) || keyLower.includes('password') || keyLower.includes('secret') || keyLower.includes('token')) {
      out[k] = REDACTED;
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = redact(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export type LogLevel = 'log' | 'warn' | 'error' | 'debug';

export interface LogMeta {
  [key: string]: unknown;
}

/**
 * Structured JSON logger. Use: new StructuredLoggerService(MyService.name).
 * Includes requestId, orgId, userId, paymentId from request context when available.
 * Redacts sensitive keys in meta. Do not log secrets or PII.
 */
export class StructuredLoggerService {
  constructor(private readonly context: string) {}

  private write(level: LogLevel, message: string, meta?: LogMeta, err?: Error): void {
    const ctx = getRequestContext();
    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...(ctx?.requestId && { requestId: ctx.requestId }),
      ...(ctx?.orgId && { orgId: ctx.orgId }),
      ...(ctx?.userId && { userId: ctx.userId }),
      ...(ctx?.paymentId && { paymentId: ctx.paymentId }),
    };
    if (meta && Object.keys(meta).length > 0) {
      payload.meta = redact(meta as Record<string, unknown>);
    }
    if (err) {
      payload.stack = err.stack ?? undefined;
      if (!payload.requestId && ctx?.requestId) payload.requestId = ctx.requestId;
    }
    const line = JSON.stringify(payload) + '\n';
    if (level === 'error') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }

  log(message: string, meta?: LogMeta): void {
    this.write('log', message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: LogMeta, err?: Error): void {
    this.write('error', message, meta, err);
  }

  debug(message: string, meta?: LogMeta): void {
    this.write('debug', message, meta);
  }
}
