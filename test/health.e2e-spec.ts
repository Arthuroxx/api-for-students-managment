import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApplication } from './utils/app.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApplication();
    prisma = app.get(PrismaService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports a healthy application and database without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      database: 'up',
    });
    expect(response.body.uptimeSeconds).toEqual(expect.any(Number));
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(response.body.timestamp).toEqual(expect.any(String));
    expect(new Date(response.body.timestamp).toISOString()).toBe(
      response.body.timestamp,
    );
  });

  it('returns 503 when PostgreSQL is unreachable', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(
      new Error('connection refused'),
    );

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(503);

    expect(response.body).toMatchObject({
      status: 'error',
      database: 'down',
    });
    expect(response.body.uptimeSeconds).toEqual(expect.any(Number));
    expect(response.body.timestamp).toEqual(expect.any(String));
  });
});
