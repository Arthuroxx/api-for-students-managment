import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestLoggingMiddleware } from './request-logging.middleware.js';

function createResponse(statusCode: number): {
  response: Response;
  emitFinish: () => void;
} {
  let finishHandler: (() => void) | undefined;
  const response = {
    statusCode,
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'finish') {
        finishHandler = handler;
      }
      return response;
    }),
  } as unknown as Response;

  return {
    response,
    emitFinish: () => finishHandler?.(),
  };
}

describe('RequestLoggingMiddleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs method, path, status, and duration as structured JSON', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const { response, emitFinish } = createResponse(201);
    const request = {
      method: 'POST',
      originalUrl: '/students?token=secret',
      url: '/students?token=secret',
    } as Request;
    const next = vi.fn() as NextFunction;

    new RequestLoggingMiddleware().use(request, response, next);
    emitFinish();

    expect(next).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();

    const message = log.mock.calls[0][0] as string;
    expect(JSON.parse(message)).toEqual({
      event: 'http_request',
      method: 'POST',
      path: '/students',
      statusCode: 201,
      durationMs: expect.any(Number),
    });
    expect(message).not.toContain('secret');
  });
});
