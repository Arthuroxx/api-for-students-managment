import { afterAll, beforeAll } from 'vitest';
import { createDatabaseClient, resetDatabase } from '../utils/database.js';
import { testDatabaseUrl } from './test-env.js';

async function cleanDatabase(): Promise<void> {
  const prisma = createDatabaseClient(testDatabaseUrl);

  try {
    await resetDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

beforeAll(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
});
