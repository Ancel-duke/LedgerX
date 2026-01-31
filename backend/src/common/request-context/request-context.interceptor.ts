import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { getRequestContext } from './request-context';

/**
 * Enriches request context with userId, orgId, paymentId when available
 * (after auth guards run). Runs early so structured logs include these for the request.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const store = getRequestContext();

    if (store) {
      const user = req.user;
      if (user?.id) store.userId = user.id;
      if (user?.organizationId) store.orgId = user.organizationId;

      const path = (req.route?.path ?? req.url ?? '').toString();
      const paymentId = req.params?.id;
      if (paymentId && path.includes('payment')) {
        store.paymentId = paymentId;
      }
    }

    return next.handle();
  }
}
