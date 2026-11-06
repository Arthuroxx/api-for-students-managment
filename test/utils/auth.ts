import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { UserRole } from '../../src/generated/prisma/enums.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

type SuperTest = ReturnType<typeof request>;
type TestInstance = ReturnType<SuperTest['get']>;

/**
 * Creates a real user row and signs a token for it. The JWT guard validates the
 * user against the database, so e2e tokens cannot use arbitrary identities.
 */
export async function createTestAccessToken(
  app: INestApplication,
  role: UserRole = UserRole.ADMIN,
): Promise<string> {
  const prisma = app.get(PrismaService);
  const email = `e2e-${randomUUID()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'not-used-in-e2e-tests',
      role,
    },
  });

  return app.get(JwtService).sign({
    sub: user.id,
    email: user.email,
    role: user.role,
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
