import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextInterceptor } from './request-context.interceptor';

@Module({
  providers: [RequestContextMiddleware, RequestContextInterceptor],
  exports: [RequestContextMiddleware, RequestContextInterceptor],
})
export class RequestContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
