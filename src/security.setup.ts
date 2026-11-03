import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

const CORS_METHODS = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'];

export function parseCorsOrigins(value: string | undefined): string[] {
  return (
    value
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

export function configureSecurity(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const corsOrigins = parseCorsOrigins(
    configService.get<string>('CORS_ORIGINS'),
  );

  app.use(helmet());

  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      methods: CORS_METHODS,
    });
  }
}
