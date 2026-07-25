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
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

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
