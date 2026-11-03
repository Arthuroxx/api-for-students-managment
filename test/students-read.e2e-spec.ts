import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import {
  createAuthenticatedRequest,
  createTestAccessToken,
} from './utils/auth.js';

const PUBLIC_FIELDS = [
  'id',
  'firstName',
  'lastName',
  'email',
  'documentNumber',
  'birthDate',
  'createdAt',
  'updatedAt',
].sort();

describe('Students read (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authRequest: ReturnType<typeof createAuthenticatedRequest>;
  const runTag = `students-read-${Date.now()}`;
  const createdIds: string[] = [];
  let firstId: string;
  let secondId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    authRequest = createAuthenticatedRequest(app, createTestAccessToken(app));

    const first = await prisma.student.create({
      data: {
        firstName: 'Read',
        lastName: 'One',
        email: `${runTag}-one@example.com`,
        documentNumber: `${runTag}-1`,
        birthDate: new Date('2000-01-01'),
      },
    });
    const second = await prisma.student.create({
      data: {
        firstName: 'Read',
        lastName: 'Two',
        email: `${runTag}-two@example.com`,
        documentNumber: `${runTag}-2`,
        birthDate: new Date('2001-02-02'),
      },
    });

    firstId = first.id;
    secondId = second.id;
    createdIds.push(first.id, second.id);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.student.deleteMany({
        where: { id: { in: createdIds } },
      });
    }

    await app.close();
  });

  it('GET /students returns persisted students without internal fields', async () => {
    const response = await authRequest
      .get('/students')
      .query({ firstName: 'Read' })
      .expect(200);

    const body = response.body as {
      data: Record<string, unknown>[];
      meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
    const ids = body.data.map((student) => student.id);

    expect(ids).toEqual(expect.arrayContaining([firstId, secondId]));
    expect(body.meta).toEqual({
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    for (const student of body.data) {
      expect(Object.keys(student).sort()).toEqual(PUBLIC_FIELDS);
    }
  });

  it('GET /students/:id returns the requested student', async () => {
    const response = await authRequest.get(`/students/${firstId}`).expect(200);

    expect(response.body).toMatchObject({
      id: firstId,
      firstName: 'Read',
      lastName: 'One',
      email: `${runTag}-one@example.com`,
      documentNumber: `${runTag}-1`,
      birthDate: '2000-01-01T00:00:00.000Z',
    });
    expect(Object.keys(response.body).sort()).toEqual(PUBLIC_FIELDS);
  });

  it('GET /students/:id returns 404 when the student does not exist', async () => {
    const missingId = randomUUID();

    const response = await authRequest
      .get(`/students/${missingId}`)
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: `Student with id "${missingId}" not found`,
    });
  });

  it('GET /students/:id returns 400 for a malformed id', async () => {
    await authRequest.get('/students/not-a-uuid').expect(400);
  });
});
