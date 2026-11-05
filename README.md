<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e and integration tests
$ npm run test:e2e

# integration tests only
$ npm run test:integration

# test coverage
$ npm run test:cov
```

The e2e suite runs against an isolated PostgreSQL database. By default its URL is derived from `DATABASE_URL` by appending `_test` to the database name. The suite recreates and migrates that database on every run, executes test files sequentially, and truncates all tables between test files; the integration suite also resets data before every test. PostgreSQL must be running (`docker compose up -d postgres`).

To override the test database, copy `.env.test.example` to `.env.test` and set `TEST_DATABASE_URL`. The test database name must be `test` or end with `_test`; the suite refuses to recreate any other database. Never point it at development or production.

## Docker Compose (API and PostgreSQL)

The full stack runs with Docker Compose: a NestJS API container and a PostgreSQL 18 container. Docker Engine and Docker Compose v2 are required.

### Quick start

```bash
# 1. create your local configuration
$ cp .env.example .env

# 2. set POSTGRES_PASSWORD and a JWT_SECRET of at least 32 characters in .env

# 3. build the image, start PostgreSQL, apply migrations and start the API
$ docker compose up --build -d
```

Verify that everything is running:

```bash
# all services should be running; app and postgres should be healthy
# use `docker compose ps -a` to also see the migration service exited with code 0
$ docker compose ps

# the API and its database connection are healthy
$ curl http://localhost:3000/health

# follow application logs
$ docker compose logs -f app
```

Swagger UI is available at `http://localhost:3000/api/docs`.

`.env` is ignored by Git; never commit real credentials. The available variables are `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `DATABASE_URL`, `TEST_DATABASE_URL`, `NODE_ENV`, `PORT`, `CORS_ORIGINS`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`, `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`. Keep the host `DATABASE_URL` in sync with the PostgreSQL credentials; Compose builds its own internal URL. `TEST_DATABASE_URL` is optional and configures the isolated e2e database. `CORS_ORIGINS` accepts a comma-separated list of allowed origins; leave it empty to disable cross-origin requests. `JWT_SECRET` must contain at least 32 characters. Environment variables are validated when the application starts.

### Container startup order and configuration

- `postgres` starts first and becomes healthy through `pg_isready`.
- `migrate` is a one-shot service that waits for PostgreSQL and runs `npx prisma migrate deploy`. It exits successfully once all migrations are applied.
- `app` starts only after PostgreSQL is healthy and the migration service completed successfully (`service_completed_successfully`). Its image also defines a health check against `GET /health`.
- Containers communicate over the Compose network using the service name `postgres`. Compose builds the internal `DATABASE_URL` from `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`, so the container never uses `localhost` to reach the database.
- `DATABASE_URL` in `.env` stays pointed at `localhost` for running the API directly with `npm run start:dev` on the host. `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`, `PORT` and `CORS_ORIGINS` are passed to the API container as environment variables.
- If `POSTGRES_PASSWORD` contains URL-reserved characters, URL-encode it in `DATABASE_URL` when running the API on the host. Compose builds the container URL from the same values, so prefer a URL-safe password.

Create or update the initial `ADMIN` user in the running stack:

```bash
$ docker compose --profile seed run --rm seed
```

### Docker image

The multi-stage `Dockerfile` builds:

| Stage | Purpose |
| --- | --- |
| `base` | Node.js 24 slim image with OpenSSL and CA certificates. |
| `deps` | Installs all dependencies and generates the Prisma client. |
| `build` | Compiles the NestJS application with `nest build`. |
| `production-deps` | Installs production dependencies only and rebuilds the native `argon2` binding. |
| `runtime` | Minimal image with `dist` and production dependencies; runs as the non-root `node` user with a `/health` health check. |
| `migrator` | Keeps the build dependencies and Prisma CLI to run `prisma migrate deploy` and the seed script. |

`.dockerignore` keeps `node_modules`, `dist`, local environment files, tests and the generated Prisma client out of the build context. The Prisma client is regenerated inside the image from `prisma/schema.prisma`.

### Start and stop

```bash
# start only PostgreSQL for local development
$ docker compose up -d postgres

# check status and health
$ docker compose ps

# follow database or API logs
$ docker compose logs -f postgres
$ docker compose logs -f app

# stop the containers (data is kept)
$ docker compose down
```

PostgreSQL is exposed on `localhost:${POSTGRES_PORT}` (default `5432`), and the API on `localhost:${PORT}` (default `3000`).

### Data persistence

Data is stored in the named volume `postgres_data`, so it survives container restarts and `docker compose down`. To delete the data as well:

```bash
$ docker compose down -v
```

### Rebuilding after code changes

```bash
$ docker compose up --build -d
```

Compose reuses cached layers, so only changed stages are rebuilt. The `app` container is recreated with the new image after the migration service succeeds.

## Prisma ORM

Prisma Client connects using `DATABASE_URL`. The client is generated into `src/generated/prisma` (ignored by Git) on `npm install` and before every build. Run `npx prisma generate` after changing `prisma/schema.prisma`.

The CLI configuration lives in `prisma7.config.ts`; run Prisma commands from the project root.

### Migrations

The schema currently defines the `Student` and `User` models. After changing `prisma/schema.prisma`:

```bash
# create and apply a migration in development (also regenerates the client)
$ npx prisma migrate dev --name <migration_name>

# apply pending migrations in production
$ npx prisma migrate deploy

# check migration status
$ npx prisma migrate status

# reset the database and reapply all migrations (destructive)
$ npx prisma migrate reset
```

## Authentication

Passwords are hashed with Argon2id. Create or update the initial `ADMIN` user from `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`:

```bash
$ npm run db:seed
```

Log in with `POST /auth/login`:

```json
{
  "email": "admin@example.com",
  "password": "change_me"
}
```

The response contains an `accessToken`, its `tokenType` (`Bearer`), `expiresIn` (seconds) and the user's `role`. Send the token on protected student endpoints:

```
Authorization: Bearer <accessToken>
```

All `/students` endpoints require a valid, unexpired JWT. The root endpoint and `POST /auth/login` are public.

### Roles and permissions

Users have one of two roles:

| Role    | Permissions                                              |
| ------- | -------------------------------------------------------- |
| `ADMIN` | List, read, create, update and delete students           |
| `USER`  | List and read students only                              |

Role checks are enforced by `@Roles()` and `RolesGuard`; requests with an insufficient role receive `403 Forbidden`. Tokens without a valid role are rejected with `401 Unauthorized`. `npm run db:seed` assigns the `ADMIN` role to the seeded user.

## Health check

`GET /health` is public and verifies that the API process is running and that PostgreSQL responds to a lightweight query. A healthy service returns `200`:

```json
{
  "status": "ok",
  "database": "up",
  "uptimeSeconds": 123.45,
  "timestamp": "2026-11-04T12:00:00.000Z"
}
```

If PostgreSQL is unreachable, the endpoint returns `503` with `status: "error"` and `database: "down"`. Use it as the readiness and liveness probe for deployments and container orchestrators.

## Logging and monitoring

HTTP requests are logged through the NestJS `Logger` as structured JSON, so they can be ingested by any log collector:

- `http_request` entries include `method`, `path`, `statusCode`, and `durationMs` for every request.
- `http_error` entries include `method`, `path`, `statusCode`, and the error name. Client errors (`4xx`) are logged as warnings and server errors (`5xx`) as errors.

Query strings, request bodies, headers, tokens, passwords, and exception messages or stack traces are never logged. Each entry is a single JSON line that includes a timestamp and the logger context added by NestJS.

## API documentation

Swagger UI is available at `/api/docs` while the API is running (for example, `http://localhost:3000/api/docs`). The OpenAPI JSON document is served at `/api/docs-json`. Use the **Authorize** button to provide a Bearer token when trying protected endpoints.

## Performance

### Database indexes

Student search uses case-insensitive partial matches (`ILIKE '%term%'`), which cannot use a regular B-tree index. The `20261105090000_add_student_performance_indexes` migration enables the `pg_trgm` extension and adds:

| Index | Purpose |
| --- | --- |
| `students_createdAt_id_idx` on `("createdAt" DESC, "id" ASC)` | Supports the default newest-first pagination order with a stable tie-breaker. |
| `students_firstName_trgm_idx` (GIN) | Accelerates partial, case-insensitive first-name search. |
| `students_lastName_trgm_idx` (GIN) | Accelerates partial, case-insensitive last-name search. |
| `students_email_trgm_idx` (GIN) | Accelerates partial, case-insensitive email search. |

The existing unique indexes on `students.email`, `students.documentNumber`, and `users.email` are kept for uniqueness and exact lookups. The e2e suite verifies these indexes and the extension through `test/database-indexes.e2e-spec.ts`.

`CREATE EXTENSION` requires the database user to be allowed to install extensions. On managed PostgreSQL services, enable `pg_trgm` from the provider console before deploying the migration if the application user cannot create it.

### Query and pagination optimizations

- The student list no longer wraps the count and page query in a read-only transaction. A partial page already reveals the exact total, so `COUNT` is only executed when the page is full or when an empty page is requested after the first one. This removes one query and the transaction overhead for common filtered and last-page requests.
- The page query keeps a deterministic `createdAt` descending order with `id` as a tie-breaker, now backed by a matching composite index.
- Authentication and student creation select only the columns they need, avoiding unnecessary data transfer.
- The JWT and roles guards are registered once in `AuthModule` and shared with feature modules instead of creating duplicate provider instances.

### Local response-time measurements

Measured with 100,000 students in PostgreSQL 18, warm cache. Values are indicative and depend on hardware and data distribution.

| Query | Before indexes | With indexes |
| --- | --- | --- |
| Partial first-name search, first page | ~68 ms (sequential scan) | ~11 ms (GIN trigram index) |
| First page ordered by `createdAt DESC, id` | ~25 ms (parallel scan + sort) | ~0.1 ms (index scan) |
| Deep page (`OFFSET 90000`) | ~65 ms (external sort) | ~23 ms (index scan) |

Deep offset pagination still scales with the offset. Clients should prefer small page numbers; the `limit` is capped at 100 by validation.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. To connect it, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It writes the app key and secret into `.env` and makes every `nest start` script (`start`, `start:dev`, `start:debug`) load it. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand: create an application and an API key at [observe.nestjs.com](https://observe.nestjs.com), and set the pair as `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment the app runs in.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
