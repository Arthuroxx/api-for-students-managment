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

The e2e suite runs against an isolated PostgreSQL database. By default its URL is derived from `DATABASE_URL` by appending `_test` to the database name. The suite recreates and migrates that database on every run, executes test files sequentially, and truncates all tables between test files; the integration suite also resets data before every test. PostgreSQL must be running (`docker compose up -d`).

To override the test database, copy `.env.test.example` to `.env.test` and set `TEST_DATABASE_URL`. The test database name must be `test` or end with `_test`; the suite refuses to recreate any other database. Never point it at development or production.

## Database (PostgreSQL)

The database runs in Docker Compose. Docker Engine and Docker Compose are required.

### Setup

Copy the environment template and set your own credentials:

```bash
$ cp .env.example .env
```

`.env` is ignored by Git; never commit real credentials. The available variables are `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `DATABASE_URL`, `TEST_DATABASE_URL`, `NODE_ENV`, `PORT`, `CORS_ORIGINS`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`, `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`. Keep `DATABASE_URL` in sync with the PostgreSQL credentials. `TEST_DATABASE_URL` is optional and configures the isolated e2e database. `CORS_ORIGINS` accepts a comma-separated list of allowed origins; leave it empty to disable cross-origin requests. `JWT_SECRET` must contain at least 32 characters. Environment variables are validated when the application starts.

### Start and stop

```bash
# start PostgreSQL in the background
$ docker compose up -d

# check status and health
$ docker compose ps

# follow logs
$ docker compose logs -f postgres

# stop the containers (data is kept)
$ docker compose down
```

PostgreSQL is exposed on `localhost:${POSTGRES_PORT}` (default `5432`).

### Data persistence

Data is stored in the named volume `postgres_data`, so it survives container restarts and `docker compose down`. To delete the data as well:

```bash
$ docker compose down -v
```

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

## API documentation

Swagger UI is available at `/api/docs` while the API is running (for example, `http://localhost:3000/api/docs`). The OpenAPI JSON document is served at `/api/docs-json`. Use the **Authorize** button to provide a Bearer token when trying protected endpoints.

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
