import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = this.buildResponseBody(exception, status);

    this.logError(exception, status, context.getRequest<Request>());

    httpAdapter.reply(context.getResponse(), responseBody, status);
  }

  private logError(
    exception: unknown,
    status: number,
    request?: Request,
  ): void {
    const method = request?.method ?? 'UNKNOWN';
    const rawUrl = request?.originalUrl ?? request?.url ?? '/';
    const path = rawUrl.split('?')[0] || '/';

    const entry = JSON.stringify({
      event: 'http_error',
      method,
      path,
      statusCode: status,
      error: exception instanceof Error ? exception.name : 'UnknownError',
    });

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(entry);
    } else {
      this.logger.warn(entry);
    }
  }

  private buildResponseBody(
    exception: unknown,
    status: number,
  ): Record<string, unknown> {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      return typeof response === 'object' && response !== null
        ? (response as Record<string, unknown>)
        : { statusCode: status, message: response };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }
}
