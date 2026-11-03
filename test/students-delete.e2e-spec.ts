import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('Students delete (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runTag = `students-delete-${Date.now()}`;
  const createdIds: string[] = [];
  let targetId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const target = await prisma.student.create({
      data: {
        firstName: 'Delete',
        lastName: 'Target',
        email: `${runTag}-target@example.com`,
        documentNumber: `${runTag}-target`,
        birthDate: new Date('2000-01-01'),
      },
    });
    const kept = await prisma.student.create({
      data: {
        firstName: 'Keep',
        lastName: 'Student',
        email: `${runTag}-kept@example.com`,
        documentNumber: `${runTag}-kept`,
        birthDate: new Date('2001-02-02'),
      },
    });

    targetId = target.id;
    createdIds.push(target.id, kept.id);
  });

  afterAll(async () => {
    await prisma.student.deleteMany({
      where: { id: { in: createdIds } },
    });
    await app.close();
  });

  it('DELETE /students/:id removes the student and returns 204', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/students/${targetId}`)
      .expect(204);

    expect(response.text).toBe('');

    const persisted = await prisma.student.findUnique({
      where: { id: targetId },
    });
    expect(persisted).toBeNull();

    await request(app.getHttpServer()).get(`/students/${targetId}`).expect(404);
  });

  it('DELETE /students/:id returns 404 when the student does not exist', async () => {
    const missingId = randomUUID();

    const response = await request(app.getHttpServer())
      .delete(`/students/${missingId}`)
      .expect(404);

    expect(response.body.message).toBe(
      `Student with id "${missingId}" not found`,
    );
  });

  it('DELETE /students/:id returns 400 for a malformed id', async () => {
    await request(app.getHttpServer())
      .delete('/students/not-a-uuid')
      .expect(400);
  });
});
