import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { setupSwagger } from './../src/swagger.setup.js';

interface OpenApiOperation {
  parameters?: Array<{ name: string; in: string }>;
  requestBody?: unknown;
  responses?: Record<string, unknown>;
  security?: unknown[];
}

interface OpenApiDocument {
  components?: {
    securitySchemes?: Record<
      string,
      { type: string; scheme: string; bearerFormat?: string }
    >;
  };
  paths: Record<string, Record<string, OpenApiOperation>>;
}

describe('Swagger documentation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Swagger UI at /api/docs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs')
      .redirects(1)
      .expect(200);

    expect(response.text).toContain('Swagger UI');
  });

  it('exposes the OpenAPI document with all student endpoints', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    const document = response.body as OpenApiDocument;
    const paths = document.paths;

    expect(paths).toHaveProperty('/auth/login');
    expect(paths).toHaveProperty('/students');
    expect(paths).toHaveProperty('/students/{id}');

    expect(paths['/auth/login']).toHaveProperty('post');
    expect(paths['/students']).toHaveProperty('get');
    expect(paths['/students']).toHaveProperty('post');
    expect(paths['/students/{id}']).toHaveProperty('get');
    expect(paths['/students/{id}']).toHaveProperty('patch');
    expect(paths['/students/{id}']).toHaveProperty('delete');
  });

  it('documents Bearer authentication for protected endpoints', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    const document = response.body as OpenApiDocument;
    const collection = document.paths['/students'];
    const byId = document.paths['/students/{id}'];

    expect(document.components?.securitySchemes?.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(document.paths['/auth/login'].post.security).toBeUndefined();
    expect(collection.get.security).toEqual([{ bearer: [] }]);
    expect(collection.post.security).toEqual([{ bearer: [] }]);
    expect(byId.get.security).toEqual([{ bearer: [] }]);
    expect(byId.patch.security).toEqual([{ bearer: [] }]);
    expect(byId.delete.security).toEqual([{ bearer: [] }]);
  });

  it('documents query parameters, request bodies and status codes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    const document = response.body as OpenApiDocument;
    const collection = document.paths['/students'];
    const byId = document.paths['/students/{id}'];

    const queryParameters = collection.get.parameters?.map(
      (parameter) => parameter.name,
    );
    expect(queryParameters).toEqual(
      expect.arrayContaining([
        'page',
        'limit',
        'firstName',
        'lastName',
        'email',
      ]),
    );

    expect(collection.post.requestBody).toBeDefined();
    expect(byId.patch.requestBody).toBeDefined();

    expect(Object.keys(collection.get.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '400', '401']),
    );
    expect(Object.keys(collection.post.responses ?? {})).toEqual(
      expect.arrayContaining(['201', '400', '401', '409']),
    );
    expect(Object.keys(byId.get.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '400', '401', '404']),
    );
    expect(Object.keys(byId.patch.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '400', '401', '404', '409']),
    );
    expect(Object.keys(byId.delete.responses ?? {})).toEqual(
      expect.arrayContaining(['204', '400', '401', '404']),
    );
  });
});
