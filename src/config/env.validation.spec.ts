import 'reflect-metadata';
import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/students',
    PORT: '8080',
    JWT_SECRET: 'test-only-jwt-secret-with-at-least-32-chars',
  };

  it('applies defaults and converts numeric values', () => {
    const env = validateEnv(validEnv);

    expect(env.PORT).toBe(8080);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toBeUndefined();
    expect(env.JWT_EXPIRES_IN_SECONDS).toBe(3600);
    expect(env.AUTH_LOGIN_RATE_LIMIT).toBe(10);
    expect(env.AUTH_LOGIN_RATE_TTL_MS).toBe(60000);
  });

  it('uses the default port when PORT is not provided', () => {
    const env = validateEnv({
      DATABASE_URL: validEnv.DATABASE_URL,
      JWT_SECRET: validEnv.JWT_SECRET,
    });

    expect(env.PORT).toBe(3000);
  });

  it('requires DATABASE_URL', () => {
    expect(() =>
      validateEnv({ PORT: '3000', JWT_SECRET: validEnv.JWT_SECRET }),
    ).toThrow(/DATABASE_URL/);
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

  it('requires a JWT secret with at least 32 characters', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: validEnv.DATABASE_URL,
        JWT_SECRET: 'too-short',
      }),
    ).toThrow(/JWT_SECRET/);

    expect(() => validateEnv({ DATABASE_URL: validEnv.DATABASE_URL })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('validates and converts the JWT expiration', () => {
    const env = validateEnv({
      ...validEnv,
      JWT_EXPIRES_IN_SECONDS: '900',
    });

    expect(env.JWT_EXPIRES_IN_SECONDS).toBe(900);
    expect(() =>
      validateEnv({ ...validEnv, JWT_EXPIRES_IN_SECONDS: '30' }),
    ).toThrow(/JWT_EXPIRES_IN_SECONDS/);
    expect(() =>
      validateEnv({ ...validEnv, JWT_EXPIRES_IN_SECONDS: 'forever' }),
    ).toThrow(/JWT_EXPIRES_IN_SECONDS/);
  });

  it('validates and converts the login rate limit', () => {
    const env = validateEnv({
      ...validEnv,
      AUTH_LOGIN_RATE_LIMIT: '25',
      AUTH_LOGIN_RATE_TTL_MS: '30000',
    });

    expect(env.AUTH_LOGIN_RATE_LIMIT).toBe(25);
    expect(env.AUTH_LOGIN_RATE_TTL_MS).toBe(30000);
    expect(() =>
      validateEnv({ ...validEnv, AUTH_LOGIN_RATE_LIMIT: '0' }),
    ).toThrow(/AUTH_LOGIN_RATE_LIMIT/);
    expect(() =>
      validateEnv({ ...validEnv, AUTH_LOGIN_RATE_TTL_MS: '500' }),
    ).toThrow(/AUTH_LOGIN_RATE_TTL_MS/);
  });
});
