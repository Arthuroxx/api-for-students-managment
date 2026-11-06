import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

const { loginRateLimit } = vi.hoisted(() => {
  const limit = 3;

  process.env.AUTH_LOGIN_RATE_LIMIT = String(limit);
  process.env.AUTH_LOGIN_RATE_TTL_MS = '60000';

  return { loginRateLimit: limit };
});

describe('Login rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after too many login attempts from the same client', async () => {
    const server = app.getHttpServer();

    // Invalid bodies are rejected by validation, but the throttler runs before
    // the validation pipe, so these attempts still consume the quota.
    for (let attempt = 0; attempt < loginRateLimit; attempt += 1) {
      const response = await request(server)
        .post('/auth/login')
        .send({})
        .expect(400);

      expect(response.headers['x-ratelimit-limit']).toBe(
        String(loginRateLimit),
      );
    }

    const blocked = await request(server).post('/auth/login').send({});

    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: 'ThrottlerException: Too Many Requests',
    });
  });
});
