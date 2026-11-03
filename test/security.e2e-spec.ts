import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

const { allowedOrigin, secondOrigin, previousCorsOrigins } = vi.hoisted(() => {
  const previousCorsOrigins = process.env.CORS_ORIGINS;
  const allowedOrigin = 'http://allowed.example';
  const secondOrigin = 'http://second.example';

  process.env.CORS_ORIGINS = `${allowedOrigin}, ${secondOrigin}`;

  return { allowedOrigin, secondOrigin, previousCorsOrigins };
});

describe('API security (e2e)', () => {
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

    if (previousCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = previousCorsOrigins;
    }
  });

  it('sets Helmet security headers', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('allows the origins configured through CORS_ORIGINS', async () => {
    for (const origin of [allowedOrigin, secondOrigin]) {
      const response = await request(app.getHttpServer())
        .get('/')
        .set('Origin', origin)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('does not allow unconfigured origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://not-allowed.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('handles CORS preflight requests for configured origins', async () => {
    const response = await request(app.getHttpServer())
      .options('/students')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'PATCH')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(response.headers['access-control-allow-methods']).toContain('PATCH');
  });
});
