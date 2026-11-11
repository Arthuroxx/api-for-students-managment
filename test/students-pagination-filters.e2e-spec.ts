import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import {
  createAuthenticatedRequest,
  createTestAccessToken,
} from './utils/auth.js';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  MAX_PAGE,
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
  let authRequest: ReturnType<typeof createAuthenticatedRequest>;
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
    authRequest = createAuthenticatedRequest(
      app,
      await createTestAccessToken(app),
    );

    for (let index = 0; index < 12; index += 1) {
      const student = await prisma.student.create({
        data: {
          firstName: `${runTag}-Student-${index}`,
          lastName: index % 2 === 0 ? 'AlphaGroup' : 'BetaGroup',
          email: `${runTag}.${index}@example.com`,
          documentNumber: `${runTag}-${index}`.toUpperCase(),
          birthDate: new Date('2000-01-01'),
        },
      });

      createdIds.push(student.id);
    }

    const literalPercent = await prisma.student.create({
      data: {
        firstName: `${runTag}-Percent%Name`,
        lastName: `Last%Name`,
        email: `${runTag}.percent%user@example.com`,
        documentNumber: `${runTag}-PCT`.toUpperCase(),
        birthDate: new Date('2000-01-01'),
      },
    });
    const literalUnderscore = await prisma.student.create({
      data: {
        firstName: `${runTag}-Under_Name`,
        lastName: `Last_Name`,
        email: `${runTag}.under_user@example.com`,
        documentNumber: `${runTag}-USR`.toUpperCase(),
        birthDate: new Date('2000-01-01'),
      },
    });
    createdIds.push(literalPercent.id, literalUnderscore.id);
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
    const response = await authRequest
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
    const firstPage = await authRequest
      .get('/students')
      .query({ firstName: runTag, page: 1, limit: 5 })
      .expect(200);
    const secondPage = await authRequest
      .get('/students')
      .query({ firstName: runTag, page: 2, limit: 5 })
      .expect(200);
    const thirdPage = await authRequest
      .get('/students')
      .query({ firstName: runTag, page: 3, limit: 5 })
      .expect(200);

    const first = firstPage.body as StudentsPageBody;
    const second = secondPage.body as StudentsPageBody;
    const third = thirdPage.body as StudentsPageBody;

    expect(first.data).toHaveLength(5);
    expect(second.data).toHaveLength(5);
    expect(third.data).toHaveLength(4);

    for (const page of [first, second]) {
      expect(page.meta).toMatchObject({ total: 14, limit: 5, totalPages: 3 });
    }
    expect(third.meta).toMatchObject({ total: 14, limit: 5, totalPages: 3 });
    expect(first.meta.page).toBe(1);
    expect(second.meta.page).toBe(2);
    expect(third.meta.page).toBe(3);

    const ids = new Set([
      ...first.data.map((student) => student.id),
      ...second.data.map((student) => student.id),
      ...third.data.map((student) => student.id),
    ]);
    expect(ids.size).toBe(14);
  });

  it('filters by lastName partially and ignoring case', async () => {
    const response = await authRequest
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
    const caseInsensitive = await authRequest
      .get('/students')
      .query({ firstName: runTag, email: runTag.toUpperCase() })
      .expect(200);
    const partial = await authRequest
      .get('/students')
      .query({ firstName: runTag, email: '.1' })
      .expect(200);

    expect((caseInsensitive.body as StudentsPageBody).meta.total).toBe(14);
    expect((partial.body as StudentsPageBody).meta.total).toBe(3);
  });

  it('treats % and _ as literal characters in filters', async () => {
    const percentFirstName = await authRequest
      .get('/students')
      .query({ firstName: `${runTag}-Percent%` })
      .expect(200);
    expect((percentFirstName.body as StudentsPageBody).meta.total).toBe(1);
    expect(
      (percentFirstName.body as StudentsPageBody).data[0]?.firstName,
    ).toContain('%');

    const underscoreFirstName = await authRequest
      .get('/students')
      .query({ firstName: `${runTag}-Under_` })
      .expect(200);
    expect((underscoreFirstName.body as StudentsPageBody).meta.total).toBe(1);
    expect(
      (underscoreFirstName.body as StudentsPageBody).data[0]?.firstName,
    ).toContain('_');

    const percentLastName = await authRequest
      .get('/students')
      .query({ lastName: 'Last%Name' })
      .expect(200);
    expect(
      (percentLastName.body as StudentsPageBody).data.some(
        (student) => student.lastName === 'Last%Name',
      ),
    ).toBe(true);

    const underscoreLastName = await authRequest
      .get('/students')
      .query({ lastName: 'Last_Name' })
      .expect(200);
    expect(
      (underscoreLastName.body as StudentsPageBody).data.some(
        (student) => student.lastName === 'Last_Name',
      ),
    ).toBe(true);

    const percentEmail = await authRequest
      .get('/students')
      .query({ email: 'percent%user' })
      .expect(200);
    expect((percentEmail.body as StudentsPageBody).meta.total).toBe(1);

    const underscoreEmail = await authRequest
      .get('/students')
      .query({ email: 'under_user' })
      .expect(200);
    expect((underscoreEmail.body as StudentsPageBody).meta.total).toBe(1);
  });

  it('returns an empty page when no student matches the filters', async () => {
    const response = await authRequest
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
    await authRequest.get('/students').query({ page: 0 }).expect(400);

    await authRequest.get('/students').query({ limit: 0 }).expect(400);

    await authRequest
      .get('/students')
      .query({ limit: MAX_LIMIT + 1 })
      .expect(400);

    await authRequest
      .get('/students')
      .query({ page: 'not-a-number' })
      .expect(400);

    await authRequest
      .get('/students')
      .query({ page: MAX_PAGE + 1 })
      .expect(400);
  });

  it('accepts maximum allowed page and limit boundaries', async () => {
    const maxLimitResponse = await authRequest
      .get('/students')
      .query({ firstName: runTag, limit: MAX_LIMIT })
      .expect(200);

    expect((maxLimitResponse.body as StudentsPageBody).meta).toEqual({
      total: 14,
      page: DEFAULT_PAGE,
      limit: MAX_LIMIT,
      totalPages: 1,
    });

    const maxPageResponse = await authRequest
      .get('/students')
      .query({ firstName: runTag, page: MAX_PAGE, limit: MAX_LIMIT })
      .expect(200);

    expect((maxPageResponse.body as StudentsPageBody).meta).toMatchObject({
      page: MAX_PAGE,
      limit: MAX_LIMIT,
      total: 0,
      totalPages: 0,
    });
    expect((maxPageResponse.body as StudentsPageBody).data).toEqual([]);
  });
});
