import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ErrorsInterceptor } from './common/interceptors/errors.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  app.setGlobalPrefix(apiPrefix);

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

  app.useGlobalInterceptors(new TransformInterceptor(), new ErrorsInterceptor());

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

  // Render provides PORT environment variable, fallback to config or 3000
  const port = process.env.PORT || configService.get<number>('app.port') || 3000;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
}

bootstrap();
