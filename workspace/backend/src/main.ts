import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

// CJS packages — use require + default unwrap so Railway/CommonJS does not crash
// with "default is not a function" (cookie-parser / helmet).
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const helmet: any = (() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('helmet');
  return m.default ?? m;
})();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cookieParser: any = (() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('cookie-parser');
  return m.default ?? m;
})();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Allow base64 file/image uploads in public onboarding submits
    bodyParser: false,
  });
  const configService = app.get(ConfigService);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express');
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  app.use(
    helmet({
      // API is called from cms.vedha.ae (different origin than Railway)
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  // Comma-separated list, e.g.
  // CORS_ORIGIN=http://localhost:3000,https://cms.vedha.ae
  const corsOriginRaw = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000',
  );
  const normalizeOrigin = (value: string) =>
    value.trim().replace(/\/+$/, '').toLowerCase();

  const allowedOrigins = [
    ...new Set(
      [
        ...corsOriginRaw.split(','),
        'http://localhost:3000',
        'https://cms.vedha.ae',
        'https://vedha.ae',
        'https://www.vedha.ae',
      ]
        .map(normalizeOrigin)
        .filter(Boolean),
    ),
  ];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow non-browser clients (no Origin header) and listed frontends
      if (
        !origin ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(normalizeOrigin(origin))
      ) {
        callback(null, true);
        return;
      }
      console.warn(`CORS blocked origin: ${origin}`);
      // Do not pass Error — that yields a 500 with no CORS headers on preflight
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 204,
  });
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TaskFlow Enterprise API')
    .setDescription('Enterprise project management platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('refresh_token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Railway injects PORT; bind 0.0.0.0 for platform health checks
  const port = Number(configService.get<string>('PORT') ?? process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`TaskFlow API running on http://0.0.0.0:${port}/api/v1`);
  console.log(`Swagger docs at http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
