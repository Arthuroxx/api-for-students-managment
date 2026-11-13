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

describe('Students update (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authRequest: ReturnType<typeof createAuthenticatedRequest>;
  const runTag = `students-update-${Date.now()}`;
  const original = {
    firstName: 'Original',
    lastName: 'Student',
    email: `${runTag}-target@example.com`,
    documentNumber: `${runTag}-target`.toUpperCase(),
    birthDate: '2000-01-01',
  };
  let targetId: string;
  let otherId: string;
  let otherEmail: string;
  let otherDocumentNumber: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    authRequest = createAuthenticatedRequest(
      app,
      await createTestAccessToken(app),
    );

    otherEmail = `${runTag}-other@example.com`;
    otherDocumentNumber = `${runTag}-other`.toUpperCase();

    const target = await prisma.student.create({
      data: {
        ...original,
        birthDate: new Date(original.birthDate),
      },
    });
    const other = await prisma.student.create({
      data: {
        firstName: 'Other',
        lastName: 'Student',
        email: otherEmail,
        documentNumber: otherDocumentNumber,
        birthDate: new Date('2001-02-02'),
      },
    });

    targetId = target.id;
    otherId = other.id;
  });

  afterAll(async () => {
    await prisma.student.deleteMany({
      where: { id: { in: [targetId, otherId] } },
    });
    await app.close();
  });

  it('PATCH /students/:id updates only the provided fields', async () => {
    const response = await authRequest
      .patch(`/students/${targetId}`)
      .send({ firstName: 'Updated', birthDate: '2002-03-04' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: targetId,
      firstName: 'Updated',
      lastName: original.lastName,
      email: original.email,
      documentNumber: original.documentNumber,
      birthDate: '2002-03-04T00:00:00.000Z',
    });

    const persisted = await prisma.student.findUnique({
      where: { id: targetId },
    });

    expect(persisted).toMatchObject({
      firstName: 'Updated',
      lastName: original.lastName,
      email: original.email,
      documentNumber: original.documentNumber,
    });
    expect(persisted?.birthDate.toISOString()).toBe('2002-03-04T00:00:00.000Z');
  });

  it('PATCH /students/:id normalizes email and documentNumber', async () => {
    const newEmail = `  ${runTag}-NORMALIZED@EXAMPLE.COM  `;
    const newDocument = `  ${runTag}-normalized-doc  `;
    const expectedEmail = `${runTag}-normalized@example.com`;
    const expectedDocument = `${runTag}-normalized-doc`.toUpperCase();

    const response = await authRequest
      .patch(`/students/${targetId}`)
      .send({
        email: newEmail,
        documentNumber: newDocument,
        firstName: '  Trimmed  ',
        lastName: '  Name  ',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      email: expectedEmail,
      documentNumber: expectedDocument,
      firstName: 'Trimmed',
      lastName: 'Name',
    });

    // restore canonical values for subsequent tests
    await authRequest
      .patch(`/students/${targetId}`)
      .send({
        email: original.email,
        documentNumber: original.documentNumber,
        firstName: 'Updated',
        lastName: original.lastName,
      })
      .expect(200);
  });

  it('PATCH /students/:id returns 409 for a duplicate email', async () => {
    const other = await prisma.student.findUniqueOrThrow({
      where: { id: otherId },
    });

    const response = await authRequest
      .patch(`/students/${targetId}`)
      .send({ email: other.email })
      .expect(409);

    expect(response.body.message).toBe(
      'A student with this email already exists',
    );

    const persisted = await prisma.student.findUniqueOrThrow({
      where: { id: targetId },
    });
    expect(persisted.email).toBe(original.email);
  });

  it('PATCH /students/:id returns 409 for a duplicate document number', async () => {
    const other = await prisma.student.findUniqueOrThrow({
      where: { id: otherId },
    });

    const response = await authRequest
      .patch(`/students/${targetId}`)
      .send({ documentNumber: other.documentNumber })
      .expect(409);

    expect(response.body.message).toBe(
      'A student with this document number already exists',
    );

    const persisted = await prisma.student.findUniqueOrThrow({
      where: { id: targetId },
    });
    expect(persisted.documentNumber).toBe(original.documentNumber);
  });

  it('PATCH /students/:id returns 404 when the student does not exist', async () => {
    const missingId = randomUUID();

    const response = await authRequest
      .patch(`/students/${missingId}`)
      .send({ firstName: 'Ghost' })
      .expect(404);

    expect(response.body.message).toBe(
      `Student with id "${missingId}" not found`,
    );
  });

  it('PATCH /students/:id returns 400 for invalid data', async () => {
    await authRequest
      .patch(`/students/${targetId}`)
      .send({ email: 'not-an-email' })
      .expect(400);

    await authRequest
      .patch(`/students/${targetId}`)
      .send({ birthDate: '2000-02-30' })
      .expect(400);

    await authRequest
      .patch(`/students/${targetId}`)
      .send({ firstName: '' })
      .expect(400);

    await authRequest
      .patch(`/students/${targetId}`)
      .send({ firstName: '   ' })
      .expect(400);
  });

  it('PATCH /students/:id rejects future birth dates', async () => {
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 1);
    const futureDate = future.toISOString().slice(0, 10);

    await authRequest
      .patch(`/students/${targetId}`)
      .send({ birthDate: futureDate })
      .expect(400);
  });

  it('PATCH /students/:id rejects null values instead of clearing fields', async () => {
    const before = await prisma.student.findUniqueOrThrow({
      where: { id: targetId },
    });

    for (const field of [
      'firstName',
      'lastName',
      'email',
      'documentNumber',
      'birthDate',
    ]) {
      const response = await authRequest
        .patch(`/students/${targetId}`)
        .send({ [field]: null })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining(field)]),
      );
    }

    // A null field must reject the whole request: valid fields in the same
    // body are not persisted.
    await authRequest
      .patch(`/students/${targetId}`)
      .send({ firstName: 'ShouldNotPersist', birthDate: null })
      .expect(400);

    const after = await prisma.student.findUniqueOrThrow({
      where: { id: targetId },
    });

    expect(after).toMatchObject({
      firstName: before.firstName,
      lastName: before.lastName,
      email: before.email,
      documentNumber: before.documentNumber,
    });
    expect(after.birthDate.toISOString()).toBe(before.birthDate.toISOString());
    expect(after.birthDate.toISOString()).not.toBe('1970-01-01T00:00:00.000Z');
  });

  it('PATCH /students/:id rejects internal fields', async () => {
    const response = await authRequest
      .patch(`/students/${targetId}`)
      .send({
        id: randomUUID(),
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'property id should not exist',
        'property createdAt should not exist',
        'property updatedAt should not exist',
      ]),
    );

    const persisted = await prisma.student.findUniqueOrThrow({
      where: { id: targetId },
    });
    expect(persisted.firstName).toBe('Updated');
  });

  it('PATCH /students/:id returns 400 for a malformed id', async () => {
    await authRequest
      .patch('/students/not-a-uuid')
      .send({ firstName: 'Updated' })
      .expect(400);
  });
});
