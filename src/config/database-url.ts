const DEFAULT_HOST = 'postgres';
const DEFAULT_PORT = 5432;
const DEFAULT_SCHEMA = 'public';

export interface DatabaseUrlParts {
  /** PostgreSQL user name, taken from `POSTGRES_USER`. */
  username: string;
  /** Raw password. It may contain any character, including `%`, `@` or `:`. */
  password: string;
  /** Database name, taken from `POSTGRES_DB`. */
  database: string;
  /** Database host. Defaults to the Compose service name `postgres`. */
  host?: string;
  /** Database port. Defaults to the PostgreSQL port `5432`. */
  port?: number | string;
  /** Value of the `schema` query parameter. Defaults to `public`. */
  schema?: string;
}

/**
 * Percent-encodes a URI component following RFC 3986.
 *
 * `encodeURIComponent` leaves `!'()*` unescaped, which is valid in generic
 * URIs but can confuse libpq. Escaping them too keeps the resulting string
 * stable regardless of the password characters.
 */
function encodeComponent(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function requireValue(name: string, value: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`${name} must not be empty`);
  }

  return value;
}

/**
 * Builds a PostgreSQL connection URL from its individual parts.
 *
 * Docker Compose interpolates environment variables before the container
 * starts, so a password containing `@`, `:`, `/`, `#` or `%` used to produce an
 * invalid URL. Building and encoding the URL at runtime keeps the password
 * intact.
 */
export function buildDatabaseUrl(parts: DatabaseUrlParts): string {
  const username = requireValue('POSTGRES_USER', parts.username);
  const password = requireValue('POSTGRES_PASSWORD', parts.password);
  const database = requireValue('POSTGRES_DB', parts.database);

  const host = (parts.host ?? DEFAULT_HOST).trim();
  if (!host || /[/@?#\s]/.test(host)) {
    throw new Error('POSTGRES_HOST must be a valid host name');
  }

  const port = Number(parts.port ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('POSTGRES_PORT must be an integer between 1 and 65535');
  }

  const schema = (parts.schema ?? DEFAULT_SCHEMA).trim() || DEFAULT_SCHEMA;

  return [
    'postgresql://',
    `${encodeComponent(username)}:${encodeComponent(password)}`,
    `@${host}:${port}`,
    `/${encodeComponent(database)}`,
    `?schema=${encodeComponent(schema)}`,
  ].join('');
}
