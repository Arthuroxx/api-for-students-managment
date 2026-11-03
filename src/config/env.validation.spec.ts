import 'reflect-metadata';
import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/students',
    PORT: '8080',
  };

  it('applies defaults and converts numeric values', () => {
    const env = validateEnv(validEnv);

    expect(env.PORT).toBe(8080);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toBeUndefined();
  });

  it('uses the default port when PORT is not provided', () => {
    const env = validateEnv({
      DATABASE_URL: validEnv.DATABASE_URL,
    });

    expect(env.PORT).toBe(3000);
  });

  it('requires DATABASE_URL', () => {
    expect(() => validateEnv({ PORT: '3000' })).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-PostgreSQL DATABASE_URL', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        DATABASE_URL: 'mysql://user:password@localhost:3306/students',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects invalid PORT values', () => {
    expect(() => validateEnv({ ...validEnv, PORT: '0' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...validEnv, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects unsupported NODE_ENV values', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('accepts a comma-separated CORS origin list', () => {
    const env = validateEnv({
      ...validEnv,
      CORS_ORIGINS: 'http://localhost:3001,https://app.example.com',
    });

    expect(env.CORS_ORIGINS).toBe(
      'http://localhost:3001,https://app.example.com',
    );
  });
});
