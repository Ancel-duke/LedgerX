import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { requestContextStorage } from './request-context';
import { RequestContextStore } from './request-context.types';

declare global {
  namespace Express {
    interface Request {
      requestContext?: RequestContextStore;
    }
  }
}

/**
 * Generates requestId per request and runs the rest of the chain inside AsyncLocalStorage
 * so that requestId (and later userId, orgId, paymentId) are available to the structured logger.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const store: RequestContextStore = { requestId };
    req.requestContext = store;
    res.setHeader('X-Request-Id', requestId);

    requestContextStorage.run(store, () => {
      next();
    });
  }
}
