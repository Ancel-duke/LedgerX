import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ErrorsInterceptor } from './common/interceptors/errors.interceptor';
import { ObservabilityInterceptor } from './common/interceptors/observability.interceptor';
import { RequestContextInterceptor } from './common/request-context/request-context.interceptor';
import { getRequestContext } from './common/request-context/request-context';
import { MetricsService } from './metrics/metrics.service';

function logProcessError(level: 'uncaughtException' | 'unhandledRejection', payload: Record<string, unknown>): void {
  const ctx = getRequestContext();
  const out = {
    timestamp: new Date().toISOString(),
    level: 'error',
    context: 'Bootstrap',
    event: level,
    ...(ctx?.requestId && { requestId: ctx.requestId }),
    ...payload,
  };
  process.stderr.write(JSON.stringify(out) + '\n');
}

process.on('uncaughtException', (err: Error) => {
  logProcessError('uncaughtException', {
    message: err?.message ?? String(err),
    stack: err?.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logProcessError('unhandledRejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: String(promise),
  });
  process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';
  const corsOrigin = configService.get<string>('app.corsOrigin') || 'http://localhost:3001';

  // Raw body for payment webhooks (signature verification)
  const httpAdapter = app.getHttpAdapter();
  const expressApp = httpAdapter.getInstance();
  expressApp.use(
    `/${apiPrefix}/payments/webhooks`,
    express.raw({ type: 'application/json' }),
  );

  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health', 'health/(.*)', 'metrics'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const metricsService = app.get(MetricsService);
  const requestContextInterceptor = app.get(RequestContextInterceptor);
  app.useGlobalInterceptors(
    requestContextInterceptor,
    new ObservabilityInterceptor(metricsService),
    new TransformInterceptor(),
    new ErrorsInterceptor(),
  );

  // Support multiple CORS origins (comma-separated string or array)
  // Default origins include localhost and Netlify production URL
  const defaultOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    'https://ledgerxx.netlify.app',
  ];

  const allowedOrigins = corsOrigin.includes(',')
    ? [...defaultOrigins, ...corsOrigin.split(',').map(origin => origin.trim())]
    : [...defaultOrigins, corsOrigin];

  // Remove duplicates
  const uniqueOrigins = [...new Set(allowedOrigins)];

  app.enableCors({
    origin: uniqueOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Render and other PaaS set PORT; bind to 0.0.0.0 so external traffic is accepted
  const port = Number(process.env.PORT) || configService.get<number>('app.port') || 3000;
  await app.listen(port, '0.0.0.0');

  process.stdout.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'log',
      context: 'Bootstrap',
      message: `Application is running on: http://0.0.0.0:${port}/${apiPrefix}`,
    }) + '\n',
  );
}

bootstrap();
