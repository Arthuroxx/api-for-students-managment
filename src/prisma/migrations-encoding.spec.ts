import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A UTF-8 byte order mark (EF BB BF) at the start of a migration makes PostgreSQL
// reject the whole file with `syntax error at or near "\uFEFF"` (SQLSTATE 42601).
// Prisma then records the migration as failed and blocks every later deploy with
// P3009 until it is resolved manually. This guard keeps BOMs out of the repository.
const MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../prisma/migrations',
);

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function migrationSqlFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(MIGRATIONS_DIR, entry.name, 'migration.sql'))
    .filter((file) => existsSync(file));
}

describe('Prisma migration files', () => {
  it('discovers at least one migration to validate', () => {
    expect(migrationSqlFiles().length).toBeGreaterThan(0);
  });

  it('never contains a UTF-8 BOM', () => {
    const offenders = migrationSqlFiles().filter((file) =>
      readFileSync(file).includes(UTF8_BOM),
    );

    expect(offenders).toEqual([]);
  });
});
