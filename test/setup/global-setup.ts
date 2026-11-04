import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { testDatabaseUrl } from './test-env.js';

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export default async function globalSetup(): Promise<void> {
  const databaseUrl = new URL(testDatabaseUrl);
  const databaseName = decodeURIComponent(
    databaseUrl.pathname.replace(/^\//, ''),
  );

  if (!databaseName) {
    throw new Error('The test database URL must include a database name');
  }

  if (!/(?:^|_)test$/.test(databaseName)) {
    throw new Error(
      `Refusing to recreate "${databaseName}": the test database name must be "test" or end with "_test"`,
    );
  }

  const maintenanceUrl = new URL(testDatabaseUrl);
  maintenanceUrl.pathname = '/postgres';
  maintenanceUrl.search = '';

  const client = new Client({ connectionString: maintenanceUrl.toString() });

  await client.connect();
  try {
    const quotedDatabase = quoteIdentifier(databaseName);

    await client.query(
      `DROP DATABASE IF EXISTS ${quotedDatabase} WITH (FORCE)`,
    );
    await client.query(`CREATE DATABASE ${quotedDatabase}`);
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  });
}
