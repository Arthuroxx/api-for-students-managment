import {
  ArgumentsHost,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function createHost(response: object): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  const reply = vi.fn();
  const response = {};
  const host = createHost(response);
  const filter = new AllExceptionsFilter({
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost);

  beforeEach(() => {
    reply.mockReset();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides details of unexpected errors', () => {
    filter.catch(new Error('connection failed with password=secret'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

  it('preserves intentional HTTP exception responses', () => {
    const exception = new NotFoundException('Student not found');

    filter.catch(exception, host);

    expect(reply).toHaveBeenCalledWith(
      response,
      exception.getResponse(),
      HttpStatus.NOT_FOUND,
    );
  });
});
