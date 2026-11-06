#!/bin/sh
set -eu

# Build DATABASE_URL from the raw POSTGRES_* variables so passwords containing
# reserved URI characters are encoded correctly. An explicit DATABASE_URL always
# wins, which keeps local/CI overrides working.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(
    node --input-type=module -e '
      import { buildDatabaseUrl } from "./dist/config/database-url.js";

      process.stdout.write(
        buildDatabaseUrl({
          username: process.env.POSTGRES_USER ?? "",
          password: process.env.POSTGRES_PASSWORD ?? "",
          database: process.env.POSTGRES_DB ?? "",
          host: process.env.DATABASE_HOST ?? "postgres",
          port: process.env.DATABASE_PORT ?? "5432",
          schema: process.env.DATABASE_SCHEMA ?? "public",
        }),
      );
    '
  )"
  export DATABASE_URL
fi

exec "$@"
