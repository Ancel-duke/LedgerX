import { AsyncLocalStorage } from 'async_hooks';
import { RequestContextStore } from './request-context.types';

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContextStorage.getStore();
}
