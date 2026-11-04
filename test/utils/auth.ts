import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { UserRole } from '../../src/generated/prisma/enums.js';

type SuperTest = ReturnType<typeof request>;
type TestInstance = ReturnType<SuperTest['get']>;

export function createTestAccessToken(
  app: INestApplication,
  role: UserRole = UserRole.ADMIN,
): string {
  return app.get(JwtService).sign({
    sub: randomUUID(),
    email: 'e2e@example.com',
    role,
  });
}

export function createAuthenticatedRequest(
  app: INestApplication,
  accessToken: string,
) {
  const server = app.getHttpServer();
  const authorize = (test: TestInstance): TestInstance =>
    test.set('Authorization', `Bearer ${accessToken}`);

  return {
    get: (url: string) => authorize(request(server).get(url)),
    post: (url: string) => authorize(request(server).post(url)),
    patch: (url: string) => authorize(request(server).patch(url)),
    delete: (url: string) => authorize(request(server).delete(url)),
  };
}
