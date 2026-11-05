import {
  ArgumentsHost,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function createHost(
  response: object,
  request: Partial<Request> = {},
): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

function parseLogCall(call: unknown[] | undefined): Record<string, unknown> {
  return JSON.parse(String(call?.[0])) as Record<string, unknown>;
}

describe('AllExceptionsFilter', () => {
  const reply = vi.fn();
  const response = {};
  const filter = new AllExceptionsFilter({
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost);
  let errorLog: ReturnType<typeof vi.spyOn>;
  let warnLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    reply.mockReset();
    errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    warnLog = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides details of unexpected errors', () => {
    const host = createHost(response, {
      method: 'GET',
      originalUrl: '/students?token=secret',
    });

    filter.catch(new Error('connection failed with password=secret'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    expect(errorLog).toHaveBeenCalledOnce();
    expect(parseLogCall(errorLog.mock.calls[0])).toEqual({
      event: 'http_error',
      method: 'GET',
      path: '/students',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Error',
    });

    const logged = String(errorLog.mock.calls[0][0]);
    expect(logged).not.toContain('secret');
    expect(logged).not.toContain('password=secret');
    expect(logged).not.toContain('stack');
  });

  it('preserves intentional HTTP exception responses', () => {
    const exception = new NotFoundException('Student not found');
    const host = createHost(response, {
      method: 'GET',
      originalUrl: '/students/123',
    });

    filter.catch(exception, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      exception.getResponse(),
      HttpStatus.NOT_FOUND,
    );
  });

  it('logs client errors as warnings without query strings', () => {
    const host = createHost(response, {
      method: 'GET',
      originalUrl: '/students/123?access_token=secret',
    });

    filter.catch(new NotFoundException('Student not found'), host);

    expect(warnLog).toHaveBeenCalledOnce();
    expect(errorLog).not.toHaveBeenCalled();
    expect(parseLogCall(warnLog.mock.calls[0])).toEqual({
      event: 'http_error',
      method: 'GET',
      path: '/students/123',
      statusCode: HttpStatus.NOT_FOUND,
      error: 'NotFoundException',
    });
    expect(String(warnLog.mock.calls[0][0])).not.toContain('secret');
  });

  it('logs unauthorized responses without request bodies or tokens', () => {
    const host = createHost(response, {
      method: 'POST',
      originalUrl: '/auth/login',
      body: { email: 'user@example.com', password: 'SuperSecret123!' },
      headers: { authorization: 'Bearer token-value' },
    });

    filter.catch(new UnauthorizedException('Invalid email or password'), host);

    expect(warnLog).toHaveBeenCalledOnce();
    expect(parseLogCall(warnLog.mock.calls[0])).toEqual({
      event: 'http_error',
      method: 'POST',
      path: '/auth/login',
      statusCode: HttpStatus.UNAUTHORIZED,
      error: 'UnauthorizedException',
    });

    const logged = String(warnLog.mock.calls[0][0]);
    expect(logged).not.toContain('SuperSecret123!');
    expect(logged).not.toContain('token-value');
    expect(logged).not.toContain('user@example.com');
  });
});
