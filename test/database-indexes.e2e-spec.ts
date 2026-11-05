import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApplication } from './utils/app.js';

interface IndexRow {
  indexname: string;
  indexdef: string;
}

interface ExtensionRow {
  extname: string;
}

async function findIndexes(
  prisma: PrismaService,
  names: string[],
): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<IndexRow[]>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = current_schema()
  `;

  return new Map(
    rows
      .filter((row) => names.includes(row.indexname))
      .map((row) => [row.indexname, row.indexdef]),
  );
}

describe('Database performance indexes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApplication();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps the unique indexes for student and user lookup fields', async () => {
    const indexes = await findIndexes(prisma, [
      'students_email_key',
      'students_documentNumber_key',
      'users_email_key',
    ]);

    expect(indexes.size).toBe(3);

    for (const definition of indexes.values()) {
      expect(definition).toContain('CREATE UNIQUE INDEX');
      expect(definition).toContain('USING btree');
    }
  });

  it('has a composite index matching the default listing order', async () => {
    const indexes = await findIndexes(prisma, ['students_createdAt_id_idx']);
    const definition = indexes.get('students_createdAt_id_idx');

    expect(definition).toBeDefined();
    expect(definition).toContain('USING btree');
    expect(definition).toContain('"createdAt" DESC');
    expect(definition).toContain(', id)');
  });

  it('has trigram indexes for case-insensitive partial search', async () => {
    const indexes = await findIndexes(prisma, [
      'students_firstName_trgm_idx',
      'students_lastName_trgm_idx',
      'students_email_trgm_idx',
    ]);

    expect(indexes.size).toBe(3);

    for (const definition of indexes.values()) {
      expect(definition).toContain('USING gin');
      expect(definition).toContain('gin_trgm_ops');
    }
  });

  it('has the pg_trgm extension installed', async () => {
    const extensions = await prisma.$queryRaw<ExtensionRow[]>`
      SELECT extname
      FROM pg_extension
      WHERE extname = 'pg_trgm'
    `;

    expect(extensions).toEqual([{ extname: 'pg_trgm' }]);
  });
});
