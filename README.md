# Student Management API

REST API for authenticating users and managing student records. The project is built with NestJS 12, Prisma 7 and PostgreSQL 18, and is prepared to run locally or as a Docker Compose stack.

The API provides JWT authentication, role-based access control, validated student CRUD operations, pagination and case-insensitive filters, a database-backed health check, structured request logs, Swagger documentation and automated unit and end-to-end tests.

## Table of contents

- [Overview](#overview)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment configuration](#environment-configuration)
- [Running locally](#running-locally)
- [Running with Docker Compose](#running-with-docker-compose)
- [Prisma and database migrations](#prisma-and-database-migrations)
- [Authentication and roles](#authentication-and-roles)
- [API reference](#api-reference)
- [End-to-end example](#end-to-end-example)
- [Error responses](#error-responses)
- [Health checks and logging](#health-checks-and-logging)
- [Tests](#tests)
- [Performance notes](#performance-notes)
- [Troubleshooting](#troubleshooting)

## Overview

The API exposes a small, well-defined student management domain:

- **Authentication:** users log in with email and password and receive a signed JWT access token.
- **Authorization:** `ADMIN` users can read and manage students; `USER` users have read-only access.
- **Student management:** create, list, read, update and delete students. Student input is normalized and validated (trimmed text, canonical `email`/`documentNumber`, non-future `birthDate`).
- **Search and pagination:** filter students by partial first name, last name or email, with bounded pagination (`page` <= 10000, `limit` <= 100). Search filters treat `%` and `_` as literal characters.
- **Health check:** `GET /health` verifies the API process and the PostgreSQL connection.
- **Observability:** every HTTP request and error is logged as structured JSON without leaking sensitive data.
- **Documentation:** interactive Swagger UI and an OpenAPI JSON document are served by the application.

## Quick start

### Docker Compose (recommended)

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_SECRET, SEED_USER_EMAIL and
# SEED_USER_PASSWORD. POSTGRES_PASSWORD may contain reserved URL characters.
docker compose up --build -d
docker compose --profile seed run --rm seed
curl http://localhost:3000/health
```

PostgreSQL, Prisma migrations and the API start in order. Swagger UI is available at `http://localhost:3000/api/docs`.

### Local process

Start PostgreSQL separately, for example with `docker compose up -d postgres`, then run:

```bash
npm ci
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

The API listens on `http://localhost:3000`. Log in with the credentials from `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`. See [Running locally](#running-locally) and [Running with Docker Compose](#running-with-docker-compose) for details.

## Architecture

The application follows NestJS modular architecture. Each feature owns its controller, service, DTOs and module, while cross-cutting concerns live in `common` and shared infrastructure lives in `prisma`, `config` and `health`.

### Request flow

```text
HTTP client
    |
    v
Helmet + CORS
    |
    v
RequestLoggingMiddleware
    |
    v
ValidationPipe (whitelist, transform)
    |
    v
JwtAuthGuard -> RolesGuard
    |
    v
Controller -> Service -> PrismaService -> PostgreSQL
    |
    v
AllExceptionsFilter (only when an exception is thrown)
```

- Global validation rejects unknown fields and transforms query strings into typed DTO values.
- `JwtAuthGuard` validates the `Authorization: Bearer <token>` header and loads the current user from the database on every request. Deleted users get `401`, and the database role overrides the role stored in the token.
- `RolesGuard` checks the role required by `@Roles(...)` using the current database role.
- `StudentsService` contains the business logic and maps Prisma errors to HTTP exceptions.
- `AllExceptionsFilter` returns consistent error bodies and logs sanitized error metadata.
- `RequestLoggingMiddleware` logs method, path, status code and duration for every request.

### Modules

| Module | Responsibility |
| --- | --- |
| `AppModule` | Root module, global configuration, middleware registration and optional NestJS Observe instrumentation. |
| `PrismaModule` | Creates the shared Prisma client using the PostgreSQL driver adapter and manages connect/disconnect lifecycle hooks. |
| `AuthModule` | Login endpoint, login rate limiting, JWT signing, password verification and shared JWT/roles guards. |
| `StudentsModule` | Protected student CRUD, filters, pagination and database error mapping. |
| `HealthModule` | Public health endpoint that executes `SELECT 1` against PostgreSQL. |
| `common` | Global exception filter, request logging middleware and shared error DTO. |
| `config` | Environment variable validation at application startup. |

### Project structure

```text
.
├── prisma/
│   ├── migrations/              # Versioned SQL migrations
│   ├── schema.prisma            # Student and User models
│   └── seed.ts                  # Creates the initial ADMIN user when absent
├── src/
│   ├── auth/                    # Login, JWT, guards, roles, password hashing
│   ├── common/                  # Exception filter, logging middleware, shared DTOs
│   ├── config/                  # Environment variable validation
│   ├── generated/prisma/        # Generated Prisma client (ignored by Git)
│   ├── health/                  # Health controller, service and DTO
│   ├── prisma/                  # Prisma service and module
│   ├── students/                # Student controller, service, DTOs and selectors
│   ├── app.module.ts            # Root module
│   ├── app.setup.ts             # Global pipes, filters and security
│   ├── main.ts                  # Application bootstrap
│   ├── security.setup.ts        # Helmet and CORS
│   └── swagger.setup.ts         # OpenAPI document and Swagger UI
├── test/                        # End-to-end tests and test utilities
├── Dockerfile                   # Multi-stage production and migration images
├── compose.yaml                 # API, PostgreSQL, migrations and optional seed
├── prisma7.config.ts            # Prisma CLI configuration and seed command
└── package.json                 # Scripts and dependencies
```

### Key design decisions

- **PostgreSQL is the source of truth.** Prisma models are migrated through versioned SQL files.
- **Passwords are hashed with Argon2id.** Plain-text passwords are never stored or logged.
- **Tokens carry the minimum identity data:** user ID, email and role. The role is validated again by `RolesGuard`.
- **All input is validated and whitelisted.** Unknown request properties return `400`.
- **Database failures are mapped to HTTP errors.** Duplicate emails or document numbers return `409`, and missing students return `404`.
- **The health check is database-aware.** The container and orchestrators can distinguish an alive process from a usable API.
- **Search is index-backed.** Trigram indexes accelerate case-insensitive partial filters, and a composite index supports the default ordering.

## Requirements

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | 24.x | Running the API, Prisma CLI and tests |
| npm | 11.x or newer | Installing dependencies (`package-lock.json` is used) |
| Docker Engine | Current release | PostgreSQL and the full container stack |
| Docker Compose | v2 or newer | `compose.yaml` (including `service_completed_successfully` dependencies) |
| PostgreSQL | 18 if not using Docker | Local database |
| Git | Any recent version | Cloning the repository |

The Docker image uses `node:24-bookworm-slim` and `postgres:18-alpine`.

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Arthuroxx/api-for-students-managment.git
cd api-for-students-managment
```

### 2. Create the environment file

```bash
cp .env.example .env
```

On PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set at least:

- `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` — credentials and database created by the PostgreSQL container.
- `DATABASE_URL` — connection string used when running the API on the host. Update it to match the same user, password, host, port and database. If the password contains reserved URL characters, percent-encode it here; Compose does this automatically.
- `JWT_SECRET` — a random value with at least 32 characters.

Generate a suitable JWT secret with Node.js:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Or with OpenSSL:

```bash
openssl rand -hex 32
```

`.env` is ignored by Git. Never commit real credentials.

### 3. Install dependencies

```bash
npm ci
```

`npm ci` installs the exact dependency versions from `package-lock.json` and runs `prisma generate` through the `postinstall` script. The generated client is written to `src/generated/prisma`, which is ignored by Git.

If npm reports that the lockfile is out of sync, use `npm install` only while intentionally updating dependencies, then commit the updated lockfile.

## Environment configuration

All variables are loaded from `.env` when running the API on the host. Docker Compose reads the same file but builds the API's internal `DATABASE_URL` automatically.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `POSTGRES_USER` | Docker Compose | — | PostgreSQL user created by the container. |
| `POSTGRES_PASSWORD` | Docker Compose | — | PostgreSQL password. Any character is supported, including `@`, `:`, `/`, `#` and `%`. |
| `POSTGRES_DB` | Docker Compose | — | Database created by the PostgreSQL container. |
| `POSTGRES_PORT` | No | `5432` | Host port mapped to PostgreSQL. Change it if `5432` is already in use. |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string used by the API, Prisma CLI and seed. For local runs use `localhost`; Compose builds its own internal URL from `POSTGRES_*`. |
| `TEST_DATABASE_URL` | No | `DATABASE_URL` with `_test` appended | Isolated database used by the e2e suite. Its name must be `test` or end with `_test`. |
| `NODE_ENV` | No | `development` | One of `development`, `production` or `test`. |
| `PORT` | No | `3000` | HTTP port used by the API and by the Compose port mapping. |
| `CORS_ORIGINS` | No | empty | Comma-separated allowed origins. Empty disables CORS. Example: `http://localhost:5173,https://app.example.com`. |
| `JWT_SECRET` | Yes | — | Secret used to sign and verify JWTs. Minimum 32 characters. |
| `JWT_EXPIRES_IN_SECONDS` | No | `3600` | Access token lifetime in seconds, between `60` and `604800`. |
| `AUTH_LOGIN_RATE_LIMIT` | No | `10` | Maximum `POST /auth/login` attempts per client IP inside the rate-limit window. |
| `AUTH_LOGIN_RATE_TTL_MS` | No | `60000` | Login rate-limit window in milliseconds (minimum `1000`). |
| `SEED_USER_EMAIL` | Seed only | — | Email of the initial `ADMIN` user created by `npm run db:seed` when it does not exist. |
| `SEED_USER_PASSWORD` | Seed only | — | Password of the initial `ADMIN` user. |
| `OBSERVE_APP_KEY` | No | placeholder | NestJS Observe application key. Leave unset to keep Observe disabled. |
| `OBSERVE_APP_SECRET` | No | placeholder | NestJS Observe application secret. |

### Environment validation

The application validates the environment before it starts. Invalid values stop the bootstrap with a message such as:

```text
Environment validation failed: JWT_SECRET must be longer than or equal to 32 characters
```

Notable constraints:

- `DATABASE_URL` must start with `postgres://` or `postgresql://`.
- `JWT_SECRET` must contain at least 32 characters.
- `PORT` must be an integer between `1` and `65535`.
- `JWT_EXPIRES_IN_SECONDS` must be an integer between `60` and `604800`.
- `AUTH_LOGIN_RATE_LIMIT` must be a positive integer.
- `AUTH_LOGIN_RATE_TTL_MS` must be an integer of at least `1000`.

### Docker-specific URL

The image entrypoint builds the container's `DATABASE_URL` at startup from the
raw `POSTGRES_*` values:

```text
postgresql://<encoded POSTGRES_USER>:<encoded POSTGRES_PASSWORD>@postgres:5432/<encoded POSTGRES_DB>?schema=public
```

The user name, password and database name are percent-encoded, so a password
such as `p@ss:word/with#chars%&?` connects correctly without manual escaping.
`DATABASE_HOST`, `DATABASE_PORT` and `DATABASE_SCHEMA` can override the
defaults (`postgres`, `5432` and `public`). Setting `DATABASE_URL` explicitly
also works and takes precedence when running the image directly.

The hostname `postgres` is the Compose service name. The host `DATABASE_URL`
remains pointed at `localhost` for local (`npm run start:dev`) execution.

## Running locally

### 1. Start PostgreSQL

Use Docker for the database while running the NestJS process on the host:

```bash
docker compose up -d postgres
docker compose ps
```

Wait until PostgreSQL reports `healthy`.

If PostgreSQL is installed natively, create a database and user matching `DATABASE_URL` instead.

### 2. Apply migrations

```bash
npx prisma migrate deploy
```

For local development, `npx prisma migrate dev` creates new migrations when the schema changes.

### 3. Create the initial ADMIN user

```bash
npm run db:seed
```

The seed is idempotent and create-only: it creates the user if it does not exist and never updates an existing user's role or password.

### 4. Start the API

```bash
npm run start:dev
```

The API is available at `http://localhost:3000` and reloads when source files change.

Verify it:

```bash
curl http://localhost:3000/health
```

Open Swagger UI at `http://localhost:3000/api/docs`.

### 5. Production-style local run

```bash
npm run build
npm run start:prod
```

`npm run build` regenerates the Prisma client and compiles the application into `dist`. `npm run start:prod` runs `node dist/main`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run start` | Start the application with the Nest CLI. |
| `npm run start:dev` | Start in watch mode. |
| `npm run start:debug` | Start in watch mode with the debugger enabled. |
| `npm run build` | Generate Prisma Client and compile with `nest build`. |
| `npm run start:prod` | Run the compiled application. |
| `npm run format` | Format TypeScript files with Prettier. |
| `npm run lint` | Run oxlint with type-aware checks. |
| `npm test` | Run unit tests. |
| `npm run test:e2e` | Run end-to-end and integration tests. |
| `npm run test:integration` | Run only `test/integration.e2e-spec.ts`. |
| `npm run test:cov` | Run unit tests with coverage. |
| `npm run db:seed` | Create the initial ADMIN user when it does not exist. |

## Running with Docker Compose

Docker Compose starts PostgreSQL, applies Prisma migrations and starts the API. This is the recommended way to run the complete stack.

### One-command startup

```bash
docker compose up --build -d
```

The command:

1. Builds the multi-stage API image.
2. Starts PostgreSQL and waits for its health check.
3. Runs the one-shot `migrate` service. Its entrypoint builds an encoded `DATABASE_URL` from `POSTGRES_*` and runs `npx prisma migrate deploy`.
4. Starts the API only after the migration service exits successfully.
5. Waits for the API health check to report healthy.

### Verify the stack

```bash
# Show running services; add -a to include the one-shot migration service
docker compose ps -a

# API and PostgreSQL health
curl http://localhost:3000/health

# Follow application logs
docker compose logs -f app

# Follow database logs
docker compose logs -f postgres
```

The API is available at `http://localhost:3000`, Swagger at `http://localhost:3000/api/docs`, and PostgreSQL at `localhost:5432` by default.

### Seed the containerised database

```bash
docker compose --profile seed run --rm seed
```

The seed service uses `SEED_USER_EMAIL` and `SEED_USER_PASSWORD` from `.env`. It creates the `ADMIN` user only when the email does not exist yet; an existing user keeps its current role and password, so re-running the seed is safe.

### Useful Docker commands

```bash
# Rebuild after changing source code or dependencies
docker compose up --build -d

# Stop the stack and keep database data
docker compose down

# Stop the stack and delete the database volume (destructive)
docker compose down -v

# Run a command inside the API container
docker compose exec app node --version

# Open a PostgreSQL shell
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

### Startup order and health checks

| Service | Type | Behaviour |
| --- | --- | --- |
| `postgres` | Long-running | Healthy when `pg_isready` succeeds. |
| `migrate` | One-shot | Waits for PostgreSQL, runs `prisma migrate deploy`, exits with code `0` on success. |
| `app` | Long-running | Starts after PostgreSQL is healthy and migrations completed. The image health check calls `GET /health`. |
| `seed` | Optional, one-shot | Enabled with the `seed` profile; runs `prisma db seed`. |

If the migration service fails, the API does not start. Inspect it with:

```bash
docker compose logs migrate
```

### Docker image stages

| Stage | Purpose |
| --- | --- |
| `base` | Node.js 24 slim image with OpenSSL and CA certificates. |
| `deps` | Installs all dependencies and generates Prisma Client. |
| `build` | Compiles the NestJS application. |
| `production-deps` | Installs production dependencies only and rebuilds the native Argon2 binding. |
| `runtime` | Minimal non-root image with `dist`, production dependencies and a health check. |
| `migrator` | Contains the Prisma CLI and seed tooling for migrations and seeding. |

`.dockerignore` excludes dependencies, build output, local environment files, tests and the generated Prisma client from the build context. The client is regenerated inside the image.

### Data persistence

PostgreSQL data is stored in the named volume `postgres_data`. It survives container restarts and `docker compose down`, but not `docker compose down -v`.

To verify persistence, create a student or seed the database, then run:

```bash
docker compose restart postgres
docker compose ps
```

The data remains available after PostgreSQL becomes healthy again.

## Prisma and database migrations

Prisma Client is generated into `src/generated/prisma` and connects through `@prisma/adapter-pg` using `DATABASE_URL`. The CLI configuration lives in `prisma7.config.ts`.

### Data model

| Model | Table | Key fields |
| --- | --- | --- |
| `Student` | `students` | UUID `id`, names, unique `email`, unique `documentNumber`, `birthDate`, timestamps. |
| `User` | `users` | UUID `id`, unique `email`, `passwordHash`, `role` (`ADMIN` or `USER`), timestamps. |

### Migration files

| Migration | Purpose |
| --- | --- |
| `20261101203411_add_student_model` | Creates the `students` table and its unique indexes. |
| `20261103182111_add_auth_user` | Creates the `users` table and the unique email index. |
| `20261104155942_add_user_role` | Adds the `UserRole` enum and the `role` column. |
| `20261105090000_add_student_performance_indexes` | Enables `pg_trgm`, adds trigram search indexes and the pagination index. |
| `20261111090000_normalize_student_identifiers` | Normalizes existing `students.email` (trim+lowercase) and `students.documentNumber` (trim+uppercase). Aborts if normalized collisions are detected (manual resolution required). |

### Common commands

```bash
# Apply existing migrations (development, CI and production)
npx prisma migrate deploy

# Create and apply a migration after editing prisma/schema.prisma
npx prisma migrate dev --name <migration_name>

# Check whether the database is up to date
npx prisma migrate status

# Regenerate the client after schema changes
npx prisma generate

# Reset the database and reapply all migrations (destructive)
npx prisma migrate reset

# Create the seeded ADMIN user when it does not exist
npm run db:seed
```

Use `migrate dev` only in development. Use `migrate deploy` in production and in the Docker migration service. Never use `migrate reset` against a database whose data you need.

### Adding a migration

1. Edit `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name describe_the_change`.
3. Run `npm run build`, `npm run lint` and the tests.
4. Commit both the schema change and the generated migration folder.

### Test database

The e2e suite uses an isolated PostgreSQL database:

- By default, the test URL is derived from `DATABASE_URL` by appending `_test` to the database name.
- Set `TEST_DATABASE_URL` in `.env.test` to override it. Start from `.env.test.example`.
- The suite only recreates a database named `test` or ending in `_test`.
- It recreates and migrates the database, runs test files sequentially and truncates tables between files.

```bash
cp .env.test.example .env.test
npm run test:e2e
```

### Prisma Client generation

The client is generated automatically by `npm ci`, `npm run build` and the Docker build. Run `npx prisma generate` manually after changing the schema if you are not rebuilding.

## Authentication and roles

### Login

`POST /auth/login` is public and expects:

```json
{
  "email": "admin@example.com",
  "password": "change_me"
}
```

The email is trimmed and matched case-insensitively. On success the API returns `200`:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "role": "ADMIN"
}
```

The JWT payload contains:

```json
{
  "sub": "user-uuid",
  "email": "admin@example.com",
  "role": "ADMIN"
}
```

Tokens are signed with `JWT_SECRET` and expire after `JWT_EXPIRES_IN_SECONDS`.

Login is rate limited per client IP. By default the API allows `10` attempts
per `60` seconds; further attempts return `429 Too Many Requests` with a
`Retry-After` header. Configure the window with `AUTH_LOGIN_RATE_LIMIT` and
`AUTH_LOGIN_RATE_TTL_MS`. The default storage is in-memory per application
instance; deployments with several replicas should provide a shared
`ThrottlerStorage`. The client IP is the direct socket address, so behind a
reverse proxy configure Express `trust proxy` for the trusted hops.

### Sending the token

Student endpoints require:

```http
Authorization: Bearer <accessToken>
```

Missing, malformed, invalid or expired tokens return `401 Unauthorized` with the message `Invalid or expired token`.

On every authenticated request the guard loads the user from the database. A
token for a deleted user is rejected with `401`, and the role stored in the
database is used instead of the role embedded in the token.

### Roles

| Role | Permissions |
| --- | --- |
| `ADMIN` | List, read, create, update and delete students. |
| `USER` | List and read students. |

Role checks are enforced by `RolesGuard` through the `@Roles(...)` decorator. A valid token with an insufficient role returns `403 Forbidden` with the message `Insufficient permissions`.

### User provisioning

The project does not expose a public registration endpoint. `npm run db:seed` creates the initial `ADMIN` user from `SEED_USER_EMAIL` and `SEED_USER_PASSWORD` only when that email is not present. Existing users are never modified: re-running the seed does not change their role or password. Additional users and roles must be provisioned directly in the database until an administration API is added.

## API reference

### Base URLs

| Environment | Base URL |
| --- | --- |
| Local or Docker | `http://localhost:3000` |
| Swagger UI | `http://localhost:3000/api/docs` |
| OpenAPI JSON | `http://localhost:3000/api/docs-json` |

All request bodies use `application/json`. Protected endpoints require the Bearer token described above. The HTTP examples use `bash` syntax; on Windows, run them in Git Bash or WSL, or adapt quoting and line continuations for PowerShell.

### Endpoint summary

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Simple root greeting. |
| `GET` | `/health` | Public | API and PostgreSQL health. |
| `POST` | `/auth/login` | Public | Authenticate and obtain a JWT. |
| `GET` | `/students` | `ADMIN`, `USER` | List students with pagination and filters. |
| `GET` | `/students/:id` | `ADMIN`, `USER` | Get one student by UUID. |
| `POST` | `/students` | `ADMIN` | Create a student. |
| `PATCH` | `/students/:id` | `ADMIN` | Partially update a student. |
| `DELETE` | `/students/:id` | `ADMIN` | Delete a student. |

### `GET /`

Public greeting used as a basic liveness check.

```bash
curl http://localhost:3000/
```

`200 OK`

```text
Hello World!
```

### `GET /health`

Public readiness and liveness probe. It executes `SELECT 1` against PostgreSQL.

```bash
curl http://localhost:3000/health
```

`200 OK`

```json
{
  "status": "ok",
  "database": "up",
  "uptimeSeconds": 123.45,
  "timestamp": "2026-11-05T12:00:00.000Z"
}
```

If PostgreSQL is unreachable, the endpoint returns `503 Service Unavailable`:

```json
{
  "status": "error",
  "database": "down",
  "uptimeSeconds": 123.45,
  "timestamp": "2026-11-05T12:00:00.000Z"
}
```

### `POST /auth/login`

Authenticate with an existing user.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "change_me"
  }'
```

`200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "role": "ADMIN"
}
```

Errors:

- `400 Bad Request` for an invalid email, a missing password, a password longer than 128 characters or unknown fields.
- `401 Unauthorized` with `Invalid email or password` for unknown users or wrong passwords.
- `429 Too Many Requests` after `AUTH_LOGIN_RATE_LIMIT` attempts from the same client IP inside the `AUTH_LOGIN_RATE_TTL_MS` window.

### `GET /students`

Returns a paginated list ordered by newest first.

**Query parameters**

| Parameter | Type | Default | Constraints | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | `1` | `1`–`10000` | Page number. Capped to bound `OFFSET = (page - 1) * limit` and avoid extreme/costly queries. |
| `limit` | integer | `10` | `1`–`100` | Items per page. |
| `firstName` | string | — | max 100 | Case-insensitive partial match. |
| `lastName` | string | — | max 100 | Case-insensitive partial match. |
| `email` | string | — | max 255 | Case-insensitive partial match. |

Filters are combined with `AND`.

```bash
curl "http://localhost:3000/students?page=1&limit=10&firstName=ana&email=example.com" \
  -H "Authorization: Bearer $TOKEN"
```

`200 OK`

```json
{
  "data": [
    {
      "id": "e6d9f2c1-8b34-4f8f-9c94-5c1f0f2b7a11",
      "firstName": "Ana",
      "lastName": "Lopez",
      "email": "ana.lopez@example.com",
      "documentNumber": "DOC-123456",
      "birthDate": "2000-05-10T00:00:00.000Z",
      "createdAt": "2026-11-03T12:00:00.000Z",
      "updatedAt": "2026-11-03T12:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

Errors:

- `400 Bad Request` for invalid pagination/filter values (including `page > 10000` or `limit > 100`).
- `401 Unauthorized` when the token is missing, invalid or expired.
- `403 Forbidden` when the authenticated role is not `ADMIN` or `USER`.

### `GET /students/:id`

Returns one student by UUID.

```bash
curl http://localhost:3000/students/e6d9f2c1-8b34-4f8f-9c94-5c1f0f2b7a11 \
  -H "Authorization: Bearer $TOKEN"
```

`200 OK`

```json
{
  "id": "e6d9f2c1-8b34-4f8f-9c94-5c1f0f2b7a11",
  "firstName": "Ana",
  "lastName": "Lopez",
  "email": "ana.lopez@example.com",
  "documentNumber": "DOC-123456",
  "birthDate": "2000-05-10T00:00:00.000Z",
  "createdAt": "2026-11-03T12:00:00.000Z",
  "updatedAt": "2026-11-03T12:00:00.000Z"
}
```

Errors:

- `400 Bad Request` when `id` is not a UUID.
- `401 Unauthorized` for a missing or invalid token.
- `403 Forbidden` for an insufficient role.
- `404 Not Found` when the student does not exist.

### `POST /students`

Creates a student. Requires `ADMIN`.

**Request body**

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `firstName` | string | Yes | Trimmed, non-empty, max 100. |
| `lastName` | string | Yes | Trimmed, non-empty, max 100. |
| `email` | string | Yes | Trimmed, lowercased, valid email, max 255, unique. |
| `documentNumber` | string | Yes | Trimmed, uppercased, non-empty, max 50, unique. |
| `birthDate` | string | Yes | ISO 8601 date (`YYYY-MM-DD`), not in the future. |

```bash
curl -X POST http://localhost:3000/students \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Ana",
    "lastName": "Lopez",
    "email": "ana.lopez@example.com",
    "documentNumber": "DOC-123456",
    "birthDate": "2000-05-10"
  }'
```

`201 Created`

```json
{
  "id": "e6d9f2c1-8b34-4f8f-9c94-5c1f0f2b7a11",
  "firstName": "Ana",
  "lastName": "Lopez",
  "email": "ana.lopez@example.com",
  "documentNumber": "DOC-123456",
  "birthDate": "2000-05-10T00:00:00.000Z",
  "createdAt": "2026-11-05T12:00:00.000Z",
  "updatedAt": "2026-11-05T12:00:00.000Z"
}
```

Errors:

- `400 Bad Request` for missing or invalid fields, unknown properties, whitespace-only text values, or a future `birthDate`.
- `401 Unauthorized` for a missing or invalid token.
- `403 Forbidden` when the role is not `ADMIN`.
- `409 Conflict` when the email or document number is already in use.

Duplicate examples:

```json
{
  "message": "A student with this email already exists",
  "error": "Conflict",
  "statusCode": 409
}
```

```json
{
  "message": "A student with this document number already exists",
  "error": "Conflict",
  "statusCode": 409
}
```

### `PATCH /students/:id`

Partially updates a student. Requires `ADMIN`. Only the provided fields are changed; omitting all fields returns the current record. A field explicitly set to `null` is rejected instead of clearing the column.

```bash
curl -X PATCH http://localhost:3000/students/e6d9f2c1-8b34-4f8f-9c94-5c1f0f2b7a11 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lastName": "Lopez Garcia",
    "email": "ana.garcia@example.com"
  }'
```

`200 OK` returns the updated student with the same shape as `GET /students/:id`.

Errors:

- `400 Bad Request` for an invalid UUID, invalid fields, `null` values or unknown properties.
- `401 Unauthorized` for a missing or invalid token.
- `403 Forbidden` when the role is not `ADMIN`.
- `404 Not Found` when the student does not exist.
- `409 Conflict` when the new email or document number is already in use.

### `DELETE /students/:id`

Deletes a student. Requires `ADMIN`.

```bash
curl -X DELETE http://localhost:3000/students/e6d9f2c1-8b34-4f8f-9c94-5c1f0f2b7a11 \
  -H "Authorization: Bearer $TOKEN" \
  -i
```

`204 No Content` with an empty body.

Errors:

- `400 Bad Request` when `id` is not a UUID.
- `401 Unauthorized` for a missing or invalid token.
- `403 Forbidden` when the role is not `ADMIN`.
- `404 Not Found` when the student does not exist.

## End-to-end example

The following example uses `curl` and `jq`. Install `jq` or copy the token and student ID manually. Run it from a shell after the API is healthy.

```bash
BASE_URL=http://localhost:3000

# 1. Log in
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"change_me"}' \
  | jq -r '.accessToken')

# 2. Create a student
STUDENT_ID=$(curl -s -X POST "$BASE_URL/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Ana",
    "lastName": "Lopez",
    "email": "ana.lopez@example.com",
    "documentNumber": "DOC-123456",
    "birthDate": "2000-05-10"
  }' \
  | jq -r '.id')

# 3. List students with a filter
curl -s "$BASE_URL/students?firstName=Ana" \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Read one student
curl -s "$BASE_URL/students/$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq

# 5. Update the student
curl -s -X PATCH "$BASE_URL/students/$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lastName":"Lopez Garcia"}' | jq

# 6. Delete the student
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$BASE_URL/students/$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN"

# 7. Confirm the student no longer exists
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/students/$STUDENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

The final status code should be `404`.

To verify role restrictions, create a `USER` account, log in with it and call `POST /students`; the API returns `403 Forbidden`.

## Error responses

Errors use a consistent JSON shape:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

`message` can be a string or an array of validation messages.

### Common status codes

| Status | Meaning | Typical cause |
| --- | --- | --- |
| `400` | Bad Request | Invalid body, query value, UUID or unknown property. |
| `401` | Unauthorized | Missing, malformed, invalid or expired JWT; wrong login credentials. |
| `403` | Forbidden | Valid token without the required role. |
| `404` | Not Found | Student does not exist. |
| `409` | Conflict | Duplicate email or document number. |
| `500` | Internal Server Error | Unexpected server failure. Details are not exposed. |
| `503` | Service Unavailable | PostgreSQL is unavailable in the health check. |

### Validation error example

```json
{
  "message": [
    "email must be an email",
    "documentNumber should not be empty",
    "property role should not exist"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

### Unauthorized example

```json
{
  "message": "Invalid or expired token",
  "error": "Unauthorized",
  "statusCode": 401
}
```

### Forbidden example

```json
{
  "message": "Insufficient permissions",
  "error": "Forbidden",
  "statusCode": 403
}
```

### Not found example

```json
{
  "message": "Student with id \"e6d9f2c1-8b34-4f8f-9c94-5c1f0f2b7a11\" not found",
  "error": "Not Found",
  "statusCode": 404
}
```

### Internal error example

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## Health checks and logging

### Health check

`GET /health` is public and performs a lightweight `SELECT 1` query. It returns `200` when both the API and PostgreSQL are available, and `503` when the database connection fails. The response includes the process uptime and an ISO timestamp. The Docker health check and Compose health check use this endpoint.

### Structured request logs

Every request is logged through the NestJS `Logger` with the `HTTP` context:

```json
{
  "event": "http_request",
  "method": "GET",
  "path": "/students",
  "statusCode": 200,
  "durationMs": 12.34
}
```

Errors are logged as `http_error` entries with the method, path, status code and error name. Client errors are logged as warnings and server errors as errors.

Query strings, request bodies, headers, tokens, passwords and exception messages or stack traces are not logged.

### Security headers and CORS

Helmet adds standard security headers. When `CORS_ORIGINS` is set, the listed origins are allowed for `GET`, `HEAD`, `POST`, `PATCH` and `DELETE`; when it is empty, CORS is disabled.

### Optional observability

The application is instrumented with NestJS Observe. It stays disabled while the default placeholder keys are used. To connect it, run:

```bash
npx @nestjs/observe link
```

Alternatively set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment. The free plan covers 300,000 events per month.

## Tests

### Unit tests

```bash
npm test
```

Unit tests cover the application controller, authentication service, guards, environment validation, exception filter, request logging middleware, student service pagination logic, login URL encoding and seed safety.

### End-to-end tests

PostgreSQL must be running before the e2e suite starts:

```bash
docker compose up -d postgres
npm run test:e2e
```

The suite covers:

- Public root and health endpoints.
- Login, invalid credentials, JWT validation and login rate limiting.
- Deleted users and role changes reflected by the JWT guard.
- Role-based access for `ADMIN` and `USER`.
- Student create, read, update and delete.
- Pagination, filters and validation, including rejection of `null` patch values.
- Duplicate conflicts and missing students.
- Structured logging without sensitive data.
- Database indexes and the `pg_trgm` extension.
- Swagger/OpenAPI documentation.
- Security headers and CORS.
- A full integration flow using a real PostgreSQL database.

The suite recreates the test database from `TEST_DATABASE_URL` or the `_test` variant of `DATABASE_URL`, applies migrations and truncates tables between files. It refuses to recreate a database whose name is not `test` or does not end in `_test`.

### Lint, format and build

```bash
npm run format
npm run lint
npm run build
```

### Coverage

```bash
npm run test:cov
```

## Performance notes

Student search uses case-insensitive partial matching (`ILIKE '%term%'`), which cannot use a regular B-tree index. The `20261105090000_add_student_performance_indexes` migration enables `pg_trgm` and adds:

| Index | Purpose |
| --- | --- |
| `students_createdAt_id_idx` | Supports the default `createdAt DESC, id ASC` pagination order. |
| `students_firstName_trgm_idx` | Accelerates partial first-name search. |
| `students_lastName_trgm_idx` | Accelerates partial last-name search. |
| `students_email_trgm_idx` | Accelerates partial email search. |

The unique indexes on `students.email`, `students.documentNumber` and `users.email` are kept for uniqueness and exact lookups.

The student list avoids an unnecessary `COUNT` query when a partial page already reveals the exact total, and it no longer wraps the page and count in a read-only transaction. The `limit` is capped at `100`; prefer small page numbers because deep offsets still scale with the offset.

Indicative measurements with 100,000 students, warm cache:

| Query | Before indexes | With indexes |
| --- | --- | --- |
| Partial first-name search, first page | ~68 ms | ~11 ms |
| First page ordered by `createdAt DESC, id` | ~25 ms | ~0.1 ms |
| Deep page (`OFFSET 90000`) | ~65 ms | ~23 ms |

`CREATE EXTENSION` requires the database user to be allowed to install extensions. On managed PostgreSQL services, enable `pg_trgm` from the provider console before deploying the migration if the application user cannot create it.

## Troubleshooting

### The API exits during startup with an environment error

Check that `.env` exists and contains `DATABASE_URL`, `JWT_SECRET` (at least 32 characters) and valid numeric values. The exact validation message is printed before the application exits.

### `ECONNREFUSED` when connecting to PostgreSQL

- Confirm that PostgreSQL is running: `docker compose ps`.
- Wait until the container reports `healthy`.
- For local execution, `DATABASE_URL` must use `localhost` and the mapped `POSTGRES_PORT`.
- For Docker execution, Compose constructs an internal URL with host `postgres`; do not override it with `localhost`.

### Port already in use

Change `PORT` or `POSTGRES_PORT` in `.env` and restart the stack. For example:

```dotenv
PORT=3001
POSTGRES_PORT=5433
```

Update `DATABASE_URL` when changing `POSTGRES_PORT` for local execution.

### Prisma client not found

```bash
npx prisma generate
```

The client is generated into `src/generated/prisma` and must exist before building or starting the API.

### Migration service keeps failing

```bash
docker compose logs migrate
```

Common causes are invalid database credentials, a database that is not ready, or a migration that conflicts with existing data. Do not delete production data to fix a migration.

### Reset a local Docker environment

This deletes all local database data:

```bash
docker compose down -v
docker compose up --build -d
```

### Seed does not change an existing user

The seed looks up `SEED_USER_EMAIL` first and only creates the `ADMIN` user when
the email is absent. It never updates an existing user's role or password. To
rotate those values, update the user explicitly in the database; running the
seed repeatedly is safe.

### `pg_trgm` permission denied

Use a PostgreSQL role that can create extensions, or enable `pg_trgm` through your managed database provider before running the migration.
