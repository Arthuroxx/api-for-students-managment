import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { hashPassword } from '../src/auth/password.js';
import { UserRole } from '../src/generated/prisma/enums.js';
import { MAX_PAGE } from '../src/students/dto/list-students-query.dto.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApplication } from './utils/app.js';
import { resetDatabase } from './utils/database.js';

interface LoginResponseBody {
  accessToken: string;
}

interface StudentBody {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string;
  birthDate: string;
}

describe('Data validation hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const password = 'Hardening-password-123!';

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  beforeAll(async () => {
    app = await createTestApplication();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await prisma.user.create({
      data: {
        email: 'hardening-admin@example.com',
        passwordHash: await hashPassword(password),
        role: UserRole.ADMIN,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'hardening-admin@example.com', password })
      .expect(200);
    adminToken = (login.body as LoginResponseBody).accessToken;
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  it('S6/S7: normalizes and trims student fields on create', async () => {
    const response = await request(app.getHttpServer())
      .post('/students')
      .set(auth())
      .send({
        firstName: '  Ana  ',
        lastName: '  Lopez  ',
        email: '  ANA.LOPEZ@EXAMPLE.COM  ',
        documentNumber: '  doc-123  ',
        birthDate: '2000-05-10',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      firstName: 'Ana',
      lastName: 'Lopez',
      email: 'ana.lopez@example.com',
      documentNumber: 'DOC-123',
    });
  });

  it('S6: detects duplicates across normalized email/documentNumber on create', async () => {
    await request(app.getHttpServer())
      .post('/students')
      .set(auth())
      .send({
        firstName: 'Ana',
        lastName: 'Lopez',
        email: 'ana@example.com',
        documentNumber: 'DOC-1',
        birthDate: '2000-01-01',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/students')
      .set(auth())
      .send({
        firstName: 'Other',
        lastName: 'User',
        email: '  ANA@EXAMPLE.COM ',
        documentNumber: 'DOC-2',
        birthDate: '2000-01-01',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/students')
      .set(auth())
      .send({
        firstName: 'Other',
        lastName: 'User',
        email: 'other@example.com',
        documentNumber: ' doc-1 ',
        birthDate: '2000-01-01',
      })
      .expect(409);
  });

  it('S6/S7: normalizes fields on update and rejects whitespace-only values', async () => {
    const created = await request(app.getHttpServer())
      .post('/students')
      .set(auth())
      .send({
        firstName: 'Ana',
        lastName: 'Lopez',
        email: 'ana@example.com',
        documentNumber: 'DOC-10',
        birthDate: '2000-01-01',
      })
      .expect(201);
    const student = created.body as StudentBody;

    const updated = await request(app.getHttpServer())
      .patch(`/students/${student.id}`)
      .set(auth())
      .send({
        firstName: '  Maria  ',
        email: '  MARIA@EXAMPLE.COM  ',
        documentNumber: '  doc-10b  ',
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      firstName: 'Maria',
      email: 'maria@example.com',
      documentNumber: 'DOC-10B',
    });

    for (const field of ['firstName', 'lastName', 'email', 'documentNumber']) {
      await request(app.getHttpServer())
        .patch(`/students/${student.id}`)
        .set(auth())
        .send({ [field]: '   ' })
        .expect(400);
    }
  });

  it('S7: rejects future birth dates on create and update', async () => {
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 1);
    const futureDate = future.toISOString().slice(0, 10);

    await request(app.getHttpServer())
      .post('/students')
      .set(auth())
      .send({
        firstName: 'Ana',
        lastName: 'Lopez',
        email: 'future@example.com',
        documentNumber: 'DOC-FUT',
        birthDate: futureDate,
      })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/students')
      .set(auth())
      .send({
        firstName: 'Ana',
        lastName: 'Lopez',
        email: 'past@example.com',
        documentNumber: 'DOC-PAST',
        birthDate: '2000-01-01',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/students/${(created.body as StudentBody).id}`)
      .set(auth())
      .send({ birthDate: futureDate })
      .expect(400);
  });

  it('S8: rejects page above maximum and accepts maximum boundary', async () => {
    await request(app.getHttpServer())
      .get('/students')
      .set(auth())
      .query({ page: MAX_PAGE + 1 })
      .expect(400);

    const response = await request(app.getHttpServer())
      .get('/students')
      .set(auth())
      .query({ page: MAX_PAGE })
      .expect(200);

    expect(response.body).toMatchObject({
      data: [],
      meta: { page: MAX_PAGE, total: 0, totalPages: 0 },
    });
  });
});
