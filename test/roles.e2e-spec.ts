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
  role: string;
}

describe('Role-based access control (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runTag = `rbac-${Date.now()}`;
  const password = 'Rbac-password-123!';
  const adminEmail = `${runTag}-admin@example.com`;
  const userEmail = `${runTag}-user@example.com`;
  const fixtureEmail = `${runTag}-fixture@example.com`;
  let adminToken: string;
  let userToken: string;
  let adminRole: string;
  let userRole: string;
  let fixtureStudentId: string;
  const createdStudentIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword(password),
        role: UserRole.ADMIN,
      },
    });
    await prisma.user.create({
      data: {
        email: userEmail,
        passwordHash: await hashPassword(password),
        role: UserRole.USER,
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);
    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userEmail, password })
      .expect(200);

    adminToken = (adminLogin.body as LoginResponseBody).accessToken;
    adminRole = (adminLogin.body as LoginResponseBody).role;
    userToken = (userLogin.body as LoginResponseBody).accessToken;
    userRole = (userLogin.body as LoginResponseBody).role;

    const fixture = await prisma.student.create({
      data: {
        firstName: 'RbacReadable',
        lastName: 'Student',
        email: fixtureEmail,
        documentNumber: `${runTag}-fixture`.toUpperCase(),
        birthDate: new Date('2000-01-01'),
      },
    });
    fixtureStudentId = fixture.id;
  });

  afterAll(async () => {
    await prisma.student.deleteMany({
      where: { id: { in: [fixtureStudentId, ...createdStudentIds] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, userEmail] } },
    });
    await app.close();
  });

  it('returns the assigned role when logging in', () => {
    expect(adminRole).toBe(UserRole.ADMIN);
    expect(userRole).toBe(UserRole.USER);
  });

  it('allows ADMIN to read and manage students', async () => {
    const authorization = { Authorization: `Bearer ${adminToken}` };

    await request(app.getHttpServer())
      .get('/students')
      .set(authorization)
      .query({ firstName: 'RbacReadable' })
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send({
        firstName: 'RbacAdminCreated',
        lastName: 'Student',
        email: `${runTag}-created@example.com`,
        documentNumber: `${runTag}-created`.toUpperCase(),
        birthDate: '2001-02-03',
      })
      .expect(201);
    const createdId = (created.body as { id: string }).id;
    createdStudentIds.push(createdId);

    await request(app.getHttpServer())
      .get(`/students/${createdId}`)
      .set(authorization)
      .expect(200);

    const updated = await request(app.getHttpServer())
      .patch(`/students/${createdId}`)
      .set(authorization)
      .send({ firstName: 'RbacAdminUpdated' })
      .expect(200);
    expect(updated.body).toMatchObject({
      id: createdId,
      firstName: 'RbacAdminUpdated',
    });

    await request(app.getHttpServer())
      .delete(`/students/${createdId}`)
      .set(authorization)
      .expect(204);
  });

  it('allows USER to read students', async () => {
    const authorization = { Authorization: `Bearer ${userToken}` };

    const list = await request(app.getHttpServer())
      .get('/students')
      .set(authorization)
      .query({ firstName: 'RbacReadable' })
      .expect(200);

    expect(
      (list.body as { data: Array<{ id: string }> }).data.map(
        (student) => student.id,
      ),
    ).toContain(fixtureStudentId);

    const byId = await request(app.getHttpServer())
      .get(`/students/${fixtureStudentId}`)
      .set(authorization)
      .expect(200);

    expect(byId.body).toMatchObject({
      id: fixtureStudentId,
      email: fixtureEmail,
    });
  });

  it('forbids USER from creating students', async () => {
    const forbiddenEmail = `${runTag}-forbidden@example.com`;
    const response = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        firstName: 'RbacForbidden',
        lastName: 'Student',
        email: forbiddenEmail,
        documentNumber: `${runTag}-forbidden`.toUpperCase(),
        birthDate: '2002-03-04',
      })
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Insufficient permissions',
    });
    await expect(
      prisma.student.findUnique({ where: { email: forbiddenEmail } }),
    ).resolves.toBeNull();
  });

  it('forbids USER from updating and deleting students', async () => {
    const authorization = { Authorization: `Bearer ${userToken}` };

    await request(app.getHttpServer())
      .patch(`/students/${fixtureStudentId}`)
      .set(authorization)
      .send({ firstName: 'RbacChanged' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/students/${fixtureStudentId}`)
      .set(authorization)
      .expect(403);

    const persisted = await prisma.student.findUniqueOrThrow({
      where: { id: fixtureStudentId },
    });
    expect(persisted.firstName).toBe('RbacReadable');
  });
});
