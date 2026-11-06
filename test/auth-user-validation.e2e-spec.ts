import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { hashPassword } from './../src/auth/password.js';
import { UserRole } from './../src/generated/prisma/enums.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

interface LoginResponseBody {
  accessToken: string;
}

describe('JWT user validation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runTag = `jwt-validation-${Date.now()}`;
  const password = 'Jwt-validation-123!';
  const removableEmail = `${runTag}-removable@example.com`;
  const downgradedEmail = `${runTag}-downgraded@example.com`;
  let removableId: string;
  let downgradedId: string;
  let removableToken: string;
  let downgradedToken: string;

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return (response.body as LoginResponseBody).accessToken;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);
    const removable = await prisma.user.create({
      data: { email: removableEmail, passwordHash, role: UserRole.ADMIN },
    });
    const downgraded = await prisma.user.create({
      data: { email: downgradedEmail, passwordHash, role: UserRole.ADMIN },
    });

    removableId = removable.id;
    downgradedId = downgraded.id;
    removableToken = await login(removableEmail);
    downgradedToken = await login(downgradedEmail);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [removableId, downgradedId] } },
    });
    await app.close();
  });

  it('accepts a token whose user still exists', async () => {
    await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${removableToken}`)
      .expect(200);
  });

  it('rejects a token after its user is deleted', async () => {
    await prisma.user.delete({ where: { id: removableId } });

    const response = await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${removableToken}`)
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid or expired token',
    });
  });

  it('uses the current database role instead of the role stored in the token', async () => {
    await prisma.user.update({
      where: { id: downgradedId },
      data: { role: UserRole.USER },
    });

    // Reading is allowed for USER, so the token keeps working.
    await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${downgradedToken}`)
      .expect(200);

    // Writing required ADMIN when the token was issued. The database is now
    // the source of truth, so the stale ADMIN claim must not grant access.
    const response = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${downgradedToken}`)
      .send({
        firstName: 'Downgraded',
        lastName: 'User',
        email: `${runTag}-created@example.com`,
        documentNumber: `${runTag}-created`,
        birthDate: '2000-01-01',
      })
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Insufficient permissions',
    });
  });
});
