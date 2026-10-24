import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

/**
 * Shared application wiring used by both src/main.ts (runtime) and
 * test/*.e2e-spec.ts so the foundation is exercised exactly as deployed.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // Request/correlation ID for EVERY incoming request — registered at root
  // level, before the /api/v1 prefix, so "/" and unknown routes are covered.
  app.use(requestIdMiddleware);

  // Foundation HTTP security headers.
  app.use(helmet());

  // Request body limits (JSON + urlencoded).
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // CORS — browser clients only; driven strictly by configuration.
  const origins = config.get<string[]>('cors.origins') ?? [];
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: false,
    maxAge: 600,
  });

  // Versioned API prefix: /api/v1
  app.setGlobalPrefix(config.get<string>('api.prefix') ?? 'api/v1');

  // Global validation boundary: reject unexpected fields, transform DTO input.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Centralized safe error envelope + request-ID propagation.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());
}
