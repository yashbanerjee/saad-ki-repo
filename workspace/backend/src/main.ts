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
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());

  // Comma-separated list, e.g.
  // CORS_ORIGIN=http://localhost:3000,https://wonderful-love-production-24ff.up.railway.app
  const corsOriginRaw = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000',
  );
  const allowedOrigins = corsOriginRaw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header) and listed frontends
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
