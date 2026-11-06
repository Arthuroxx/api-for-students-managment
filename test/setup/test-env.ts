import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const rootEnvFile = resolve(process.cwd(), '.env');
const testEnvFile = resolve(process.cwd(), '.env.test');

if (existsSync(rootEnvFile)) {
  loadEnv({ path: rootEnvFile, quiet: true });
}

if (existsSync(testEnvFile)) {
  loadEnv({ path: testEnvFile, override: true, quiet: true });
}

function resolveTestDatabaseUrl(): string {
  const configuredUrl = process.env.TEST_DATABASE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  const baseUrl = process.env.DATABASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      'DATABASE_URL or TEST_DATABASE_URL must be defined to run the e2e tests',
    );
  }

  const url = new URL(baseUrl);
  const database = url.pathname.replace(/^\//, '');

  if (!database) {
    throw new Error('DATABASE_URL must include a database name');
  }

  if (!database.endsWith('_test')) {
    url.pathname = `/${database}_test`;
  }

  return url.toString();
}

export const testDatabaseUrl = resolveTestDatabaseUrl();
export const testJwtSecret =
  process.env.JWT_SECRET ?? 'test-only-jwt-secret-with-at-least-32-chars';

export const testEnv: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl,
  JWT_SECRET: testJwtSecret,
  JWT_EXPIRES_IN_SECONDS: process.env.JWT_EXPIRES_IN_SECONDS ?? '3600',
  // Most e2e files log in several times; the dedicated rate-limit spec lowers
  // this value before the application module is loaded.
  AUTH_LOGIN_RATE_LIMIT: '1000',
  AUTH_LOGIN_RATE_TTL_MS: '60000',
};
