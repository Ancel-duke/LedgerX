import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';

/**
 * In-process domain event bus. Publishes events asynchronously (non-blocking);
 * handlers run via EventEmitter2.emitAsync so the publisher does not wait.
 * Events must be published only AFTER successful database transactions.
 */
@Injectable()
export class DomainEventBus {
  private readonly logger = new StructuredLoggerService(DomainEventBus.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publish a domain event. Fire-and-forget: handlers run async and do not block the caller.
   * Use only after the related database transaction has committed.
   */
  publish(eventName: string, payload: object): void {
    this.eventEmitter
      .emitAsync(eventName, payload)
      .catch((err) => {
        const e = err instanceof Error ? err : new Error(String(err));
        this.logger.error('Domain event handler error', { eventName }, e);
      });
  }
}
