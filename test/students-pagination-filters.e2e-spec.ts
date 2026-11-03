import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
} from './../src/students/dto/list-students-query.dto.js';

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface StudentsPageBody {
  data: StudentItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

describe('Students pagination and filters (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runTag = `pagination-${Date.now()}`;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    for (let index = 0; index < 12; index += 1) {
      const student = await prisma.student.create({
        data: {
          firstName: `${runTag}-Student-${index}`,
          lastName: index % 2 === 0 ? 'AlphaGroup' : 'BetaGroup',
          email: `${runTag}.${index}@example.com`,
          documentNumber: `${runTag}-${index}`,
          birthDate: new Date('2000-01-01'),
        },
      });

      createdIds.push(student.id);
    }
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.student.deleteMany({
        where: { id: { in: createdIds } },
      });
    }

    await app.close();
  });

  it('filters partially by firstName, ignores case and applies defaults', async () => {
    const response = await request(app.getHttpServer())
      .get('/students')
      .query({ firstName: `${runTag.toUpperCase()}-STUDENT` })
      .expect(200);

    const body = response.body as StudentsPageBody;

    expect(body.meta).toEqual({
      total: 12,
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      totalPages: 2,
    });
    expect(body.data).toHaveLength(DEFAULT_LIMIT);
    expect(
      body.data.every((student) => student.firstName.startsWith(runTag)),
    ).toBe(true);
  });

  it('paginates results without overlapping pages', async () => {
    const firstPage = await request(app.getHttpServer())
      .get('/students')
      .query({ firstName: runTag, page: 1, limit: 5 })
      .expect(200);
    const secondPage = await request(app.getHttpServer())
      .get('/students')
      .query({ firstName: runTag, page: 2, limit: 5 })
      .expect(200);
    const thirdPage = await request(app.getHttpServer())
      .get('/students')
      .query({ firstName: runTag, page: 3, limit: 5 })
      .expect(200);

    const first = firstPage.body as StudentsPageBody;
    const second = secondPage.body as StudentsPageBody;
    const third = thirdPage.body as StudentsPageBody;

    expect(first.data).toHaveLength(5);
    expect(second.data).toHaveLength(5);
    expect(third.data).toHaveLength(2);

    for (const page of [first, second, third]) {
      expect(page.meta).toMatchObject({ total: 12, limit: 5, totalPages: 3 });
    }
    expect(first.meta.page).toBe(1);
    expect(second.meta.page).toBe(2);
    expect(third.meta.page).toBe(3);

    const ids = new Set([
      ...first.data.map((student) => student.id),
      ...second.data.map((student) => student.id),
      ...third.data.map((student) => student.id),
    ]);
    expect(ids.size).toBe(12);
  });

  it('filters by lastName partially and ignoring case', async () => {
    const response = await request(app.getHttpServer())
      .get('/students')
      .query({ firstName: runTag, lastName: 'phagro' })
      .expect(200);

    const body = response.body as StudentsPageBody;

    expect(body.meta.total).toBe(6);
    expect(body.data).toHaveLength(6);
    expect(
      body.data.every((student) => student.lastName === 'AlphaGroup'),
    ).toBe(true);
  });

  it('filters by email partially and ignoring case', async () => {
    const caseInsensitive = await request(app.getHttpServer())
      .get('/students')
      .query({ firstName: runTag, email: runTag.toUpperCase() })
      .expect(200);
    const partial = await request(app.getHttpServer())
      .get('/students')
      .query({ firstName: runTag, email: '.1' })
      .expect(200);

    expect((caseInsensitive.body as StudentsPageBody).meta.total).toBe(12);
    expect((partial.body as StudentsPageBody).meta.total).toBe(3);
  });

  it('returns an empty page when no student matches the filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/students')
      .query({ firstName: runTag, email: 'no-match@example.com' })
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: {
        total: 0,
        page: DEFAULT_PAGE,
        limit: DEFAULT_LIMIT,
        totalPages: 0,
      },
    });
  });

  it('rejects invalid pagination parameters', async () => {
    await request(app.getHttpServer())
      .get('/students')
      .query({ page: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .get('/students')
      .query({ limit: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .get('/students')
      .query({ limit: MAX_LIMIT + 1 })
      .expect(400);

    await request(app.getHttpServer())
      .get('/students')
      .query({ page: 'not-a-number' })
      .expect(400);
  });

  it('accepts the maximum allowed limit', async () => {
    const response = await request(app.getHttpServer())
      .get('/students')
      .query({ firstName: runTag, limit: MAX_LIMIT })
      .expect(200);

    expect((response.body as StudentsPageBody).meta).toEqual({
      total: 12,
      page: DEFAULT_PAGE,
      limit: MAX_LIMIT,
      totalPages: 1,
    });
  });
});
