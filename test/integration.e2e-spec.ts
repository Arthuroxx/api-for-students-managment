import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApplication } from './utils/app.js';
import { resetDatabase } from './utils/database.js';

interface LoginResponseBody {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  role: string;
}

interface StudentResponseBody {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string;
  birthDate: string;
  createdAt: string;
  updatedAt: string;
}

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
}

const password = 'Integration-password-123!';
const adminEmail = 'integration-admin@example.com';
const userEmail = 'integration-user@example.com';

describe('Student management integration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let passwordHash: string;
  let adminId: string;
  let adminToken: string;
  let userToken: string;

  const studentPayload = {
    firstName: 'Integration',
    lastName: 'Student',
    email: 'integration.student@example.com',
    documentNumber: 'INTEGRATION-001',
    birthDate: '2004-05-06',
  };

  async function login(email: string, loginPassword: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: loginPassword })
      .expect(200);

    return (response.body as LoginResponseBody).accessToken;
  }

  beforeAll(async () => {
    app = await createTestApplication();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    passwordHash = await hashPassword(password);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
      },
    });
    await prisma.user.create({
      data: {
        email: userEmail,
        passwordHash,
        role: UserRole.USER,
      },
    });

    adminId = admin.id;
    adminToken = await login(adminEmail, password);
    userToken = await login(userEmail, password);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  it('starts every test with a clean database', async () => {
    await expect(prisma.student.count()).resolves.toBe(0);
    await expect(prisma.user.count()).resolves.toBe(2);
  });

  it('completes the JWT login flow and authorizes protected requests', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail.toUpperCase(), password })
      .expect(200);

    const body = response.body as LoginResponseBody;

    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBe(3600);
    expect(body.role).toBe(UserRole.ADMIN);
    await expect(
      jwtService.verifyAsync(body.accessToken),
    ).resolves.toMatchObject({
      sub: adminId,
      email: adminEmail,
      role: UserRole.ADMIN,
    });

    await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
  });

  it('rejects invalid credentials, payloads, and tokens', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: 'wrong-password' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@example.com', password })
      .expect(401);

    expect(wrongPassword.body).toMatchObject({
      message: 'Invalid email or password',
    });
    expect(unknownEmail.body).toMatchObject({
      message: 'Invalid email or password',
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password, role: UserRole.ADMIN })
      .expect(400);

    await request(app.getHttpServer()).get('/students').expect(401);

    const invalidToken = jwtService.sign(
      { sub: adminId, email: adminEmail, role: UserRole.ADMIN },
      { secret: 'another-test-secret-with-32-characters-min' },
    );
    const expiredToken = jwtService.sign(
      { sub: adminId, email: adminEmail, role: UserRole.ADMIN },
      { expiresIn: -1 },
    );
    const roleLessToken = jwtService.sign({
      sub: adminId,
      email: adminEmail,
    });

    for (const token of [invalidToken, expiredToken, roleLessToken]) {
      await request(app.getHttpServer())
        .get('/students')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }
  });

  it('allows ADMIN to complete the student CRUD lifecycle', async () => {
    const authorization = { Authorization: `Bearer ${adminToken}` };

    const created = await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send(studentPayload)
      .expect(201);
    const createdStudent = created.body as StudentResponseBody;

    expect(createdStudent).toMatchObject({
      ...studentPayload,
      birthDate: '2004-05-06T00:00:00.000Z',
    });
    expect(createdStudent.id).toEqual(expect.any(String));

    const list = await request(app.getHttpServer())
      .get('/students')
      .set(authorization)
      .query({ email: studentPayload.email })
      .expect(200);

    expect((list.body as { data: StudentResponseBody[] }).data).toContainEqual(
      expect.objectContaining({ id: createdStudent.id }),
    );

    const found = await request(app.getHttpServer())
      .get(`/students/${createdStudent.id}`)
      .set(authorization)
      .expect(200);

    expect(found.body).toMatchObject({
      id: createdStudent.id,
      email: studentPayload.email,
    });

    const updated = await request(app.getHttpServer())
      .patch(`/students/${createdStudent.id}`)
      .set(authorization)
      .send({ firstName: 'Updated', birthDate: '2005-06-07' })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: createdStudent.id,
      firstName: 'Updated',
      lastName: studentPayload.lastName,
      birthDate: '2005-06-07T00:00:00.000Z',
    });

    await request(app.getHttpServer())
      .delete(`/students/${createdStudent.id}`)
      .set(authorization)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/students/${createdStudent.id}`)
      .set(authorization)
      .expect(404);
  });

  it('allows USER to read students but forbids every mutation', async () => {
    const adminAuthorization = { Authorization: `Bearer ${adminToken}` };
    const userAuthorization = { Authorization: `Bearer ${userToken}` };

    const created = await request(app.getHttpServer())
      .post('/students')
      .set(adminAuthorization)
      .send(studentPayload)
      .expect(201);
    const student = created.body as StudentResponseBody;

    const list = await request(app.getHttpServer())
      .get('/students')
      .set(userAuthorization)
      .query({ email: studentPayload.email })
      .expect(200);

    expect(
      (list.body as { data: StudentResponseBody[] }).data.map(
        (item) => item.id,
      ),
    ).toContain(student.id);

    await request(app.getHttpServer())
      .get(`/students/${student.id}`)
      .set(userAuthorization)
      .expect(200);

    const deniedCreate = await request(app.getHttpServer())
      .post('/students')
      .set(userAuthorization)
      .send({
        ...studentPayload,
        email: 'user-forbidden@example.com',
        documentNumber: 'USER-FORBIDDEN-001',
      })
      .expect(403);

    expect(deniedCreate.body).toMatchObject({
      statusCode: 403,
      message: 'Insufficient permissions',
    });
    await expect(
      prisma.student.findUnique({
        where: { email: 'user-forbidden@example.com' },
      }),
    ).resolves.toBeNull();

    await request(app.getHttpServer())
      .patch(`/students/${student.id}`)
      .set(userAuthorization)
      .send({ firstName: 'Forbidden' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/students/${student.id}`)
      .set(userAuthorization)
      .expect(403);

    const persisted = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
    });
    expect(persisted.firstName).toBe(studentPayload.firstName);
  });

  it('validates student payloads and rejects unknown fields', async () => {
    const authorization = { Authorization: `Bearer ${adminToken}` };

    const missingFields = await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send({})
      .expect(400);
    expect((missingFields.body as ErrorResponseBody).message).toEqual(
      expect.arrayContaining([
        'firstName should not be empty',
        'lastName should not be empty',
        'email must be an email',
        'documentNumber should not be empty',
        'birthDate must be a valid ISO 8601 date string',
      ]),
    );

    await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send({ ...studentPayload, email: 'not-an-email' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send({ ...studentPayload, birthDate: '2004-02-30' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send({ ...studentPayload, role: UserRole.ADMIN })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send(studentPayload)
      .expect(201);
    const student = created.body as StudentResponseBody;

    await request(app.getHttpServer())
      .patch(`/students/${student.id}`)
      .set(authorization)
      .send({ email: 'not-an-email' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/students/${student.id}`)
      .set(authorization)
      .send({ id: randomUUID() })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/students/not-a-uuid')
      .set(authorization)
      .send({ firstName: 'Updated' })
      .expect(400);
  });

  it('rejects duplicate emails and document numbers with 409 responses', async () => {
    const authorization = { Authorization: `Bearer ${adminToken}` };

    await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send(studentPayload)
      .expect(201);

    const duplicateEmail = await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send({
        ...studentPayload,
        documentNumber: 'INTEGRATION-002',
      })
      .expect(409);
    expect(duplicateEmail.body).toMatchObject({
      message: 'A student with this email already exists',
    });

    const duplicateDocument = await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send({
        ...studentPayload,
        email: 'integration.second@example.com',
      })
      .expect(409);
    expect(duplicateDocument.body).toMatchObject({
      message: 'A student with this document number already exists',
    });

    const second = await request(app.getHttpServer())
      .post('/students')
      .set(authorization)
      .send({
        ...studentPayload,
        email: 'integration.second@example.com',
        documentNumber: 'INTEGRATION-002',
      })
      .expect(201);

    const duplicateUpdate = await request(app.getHttpServer())
      .patch(`/students/${(second.body as StudentResponseBody).id}`)
      .set(authorization)
      .send({ email: studentPayload.email })
      .expect(409);
    expect(duplicateUpdate.body).toMatchObject({
      message: 'A student with this email already exists',
    });
  });

  it('returns the expected HTTP errors for missing or malformed resources', async () => {
    const authorization = { Authorization: `Bearer ${adminToken}` };
    const missingId = randomUUID();

    for (const response of [
      await request(app.getHttpServer())
        .get(`/students/${missingId}`)
        .set(authorization)
        .expect(404),
      await request(app.getHttpServer())
        .patch(`/students/${missingId}`)
        .set(authorization)
        .send({ firstName: 'Missing' })
        .expect(404),
      await request(app.getHttpServer())
        .delete(`/students/${missingId}`)
        .set(authorization)
        .expect(404),
    ]) {
      expect(response.body).toMatchObject({
        statusCode: 404,
        message: `Student with id "${missingId}" not found`,
      });
    }

    await request(app.getHttpServer())
      .get('/students/not-a-uuid')
      .set(authorization)
      .expect(400);
    await request(app.getHttpServer())
      .get('/students')
      .set(authorization)
      .query({ page: 0 })
      .expect(400);
  });
});
