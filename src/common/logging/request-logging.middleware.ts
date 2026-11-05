import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = performance.now();

    response.on('finish', () => {
      const durationMs = Number((performance.now() - startedAt).toFixed(2));
      const path = (request.originalUrl ?? request.url).split('?')[0] || '/';

      this.logger.log(
        JSON.stringify({
          event: 'http_request',
          method: request.method,
          path,
          statusCode: response.statusCode,
          durationMs,
        }),
      );
    });

    next();
  }
}
