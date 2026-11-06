import { buildDatabaseUrl } from './database-url.js';

describe('buildDatabaseUrl', () => {
  it('encodes every reserved password character', () => {
    const url = buildDatabaseUrl({
      username: 'student',
      password: 'p@ss:word/with#chars%&?',
      database: 'students',
      host: 'postgres',
      port: 5432,
    });

    expect(url).toBe(
      'postgresql://student:p%40ss%3Aword%2Fwith%23chars%25%26%3F@postgres:5432/students?schema=public',
    );

    const parsed = new URL(url);
    expect(decodeURIComponent(parsed.password)).toBe('p@ss:word/with#chars%&?');
    expect(decodeURIComponent(parsed.username)).toBe('student');
    expect(decodeURIComponent(parsed.pathname.slice(1))).toBe('students');
    expect(parsed.searchParams.get('schema')).toBe('public');
  });

  it('encodes reserved characters in the user name and database', () => {
    const url = buildDatabaseUrl({
      username: 'user@example.com',
      password: 'secret',
      database: 'my database/one',
    });

    const parsed = new URL(url);
    expect(decodeURIComponent(parsed.username)).toBe('user@example.com');
    expect(decodeURIComponent(parsed.pathname.slice(1))).toBe(
      'my database/one',
    );
  });

  it('escapes characters that encodeURIComponent leaves untouched', () => {
    const url = buildDatabaseUrl({
      username: 'user',
      password: "!()*'",
      database: 'students',
    });

    expect(url).toContain('%21%28%29%2A%27');
  });

  it('uses the Compose defaults for host, port and schema', () => {
    const url = buildDatabaseUrl({
      username: 'student',
      password: 'secret',
      database: 'students',
    });

    expect(url).toBe(
      'postgresql://student:secret@postgres:5432/students?schema=public',
    );
  });

  it('accepts the port as a string and a custom schema', () => {
    const url = buildDatabaseUrl({
      username: 'student',
      password: 'secret',
      database: 'students',
      host: 'database.internal',
      port: '6543',
      schema: 'tenant one',
    });

    const parsed = new URL(url);
    expect(parsed.hostname).toBe('database.internal');
    expect(parsed.port).toBe('6543');
    expect(parsed.searchParams.get('schema')).toBe('tenant one');
  });

  it('rejects missing credentials and invalid connection parts', () => {
    expect(() =>
      buildDatabaseUrl({ username: '', password: 'secret', database: 'db' }),
    ).toThrow('POSTGRES_USER must not be empty');

    expect(() =>
      buildDatabaseUrl({ username: 'user', password: '', database: 'db' }),
    ).toThrow('POSTGRES_PASSWORD must not be empty');

    expect(() =>
      buildDatabaseUrl({ username: 'user', password: 'secret', database: ' ' }),
    ).toThrow('POSTGRES_DB must not be empty');

    expect(() =>
      buildDatabaseUrl({
        username: 'user',
        password: 'secret',
        database: 'db',
        host: 'postgres/evil',
      }),
    ).toThrow('POSTGRES_HOST must be a valid host name');

    expect(() =>
      buildDatabaseUrl({
        username: 'user',
        password: 'secret',
        database: 'db',
        port: 70000,
      }),
    ).toThrow('POSTGRES_PORT must be an integer between 1 and 65535');

    expect(() =>
      buildDatabaseUrl({
        username: 'user',
        password: 'secret',
        database: 'db',
        port: 'not-a-number',
      }),
    ).toThrow('POSTGRES_PORT must be an integer between 1 and 65535');
  });
});
