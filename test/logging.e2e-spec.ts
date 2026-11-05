import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApplication } from './utils/app.js';

interface LogEntry {
  event?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  error?: string;
}

function parseEntries(spy: { mock: { calls: unknown[][] } }): LogEntry[] {
  return spy.mock.calls
    .map(([message]) => {
      try {
        return JSON.parse(String(message)) as LogEntry;
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is LogEntry => entry !== undefined);
}

function loggedText(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.map(([message]) => String(message)).join('\n');
}

async function flushLogs(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('HTTP logging (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    app = await createTestApplication();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs method, path, status, and duration without query strings or tokens', async () => {
    await request(app.getHttpServer())
      .get('/health?token=super-secret-query-value')
      .set('Authorization', 'Bearer super-secret-token-value')
      .expect(200);
    await flushLogs();

    const requests = parseEntries(logSpy).filter(
      (entry) => entry.event === 'http_request',
    );

    expect(requests).toContainEqual({
      event: 'http_request',
      method: 'GET',
      path: '/health',
      statusCode: 200,
      durationMs: expect.any(Number),
    });

    const text = loggedText(logSpy);
    expect(text).not.toContain('super-secret-query-value');
    expect(text).not.toContain('super-secret-token-value');
  });

  it('logs 4xx errors as warnings without request bodies or credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/login?token=super-secret-query-value')
      .send({
        email: 'missing@example.com',
        password: 'SuperSecretPassword123!',
      })
      .expect(401);
    await flushLogs();

    const errors = parseEntries(warnSpy).filter(
      (entry) => entry.event === 'http_error',
    );

    expect(errors).toContainEqual({
      event: 'http_error',
      method: 'POST',
      path: '/auth/login',
      statusCode: 401,
      error: 'UnauthorizedException',
    });

    const text = loggedText(warnSpy);
    expect(text).not.toContain('SuperSecretPassword123!');
    expect(text).not.toContain('missing@example.com');
    expect(text).not.toContain('super-secret-query-value');
  });

  it('logs 404 responses with the requested path', async () => {
    await request(app.getHttpServer())
      .get('/does-not-exist?secret=hidden-value')
      .expect(404);
    await flushLogs();

    const errors = parseEntries(warnSpy).filter(
      (entry) => entry.event === 'http_error',
    );

    expect(errors).toContainEqual({
      event: 'http_error',
      method: 'GET',
      path: '/does-not-exist',
      statusCode: 404,
      error: 'NotFoundException',
    });
    expect(loggedText(warnSpy)).not.toContain('hidden-value');
  });

  it('logs 5xx errors without leaking exception details', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(
      new Error('connection failed with password=super-secret'),
    );

    await request(app.getHttpServer()).get('/health').expect(503);
    await flushLogs();

    const errors = parseEntries(errorSpy).filter(
      (entry) => entry.event === 'http_error',
    );

    expect(errors).toContainEqual({
      event: 'http_error',
      method: 'GET',
      path: '/health',
      statusCode: 503,
      error: 'ServiceUnavailableException',
    });
    expect(loggedText(errorSpy)).not.toContain('super-secret');
  });
});
