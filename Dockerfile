# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# Prisma needs OpenSSL at runtime and for its schema engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Build DATABASE_URL from POSTGRES_* at container start (see docker/entrypoint.sh).
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Install all dependencies, including the Nest CLI and Prisma CLI.
# Prisma generation needs the schema and config, so copy them before npm ci.
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN npm ci

# Compile the NestJS application and regenerate the Prisma client.
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Install only production dependencies for the runtime image.
# The Prisma client is already generated in dist, so the CLI is not needed here.
FROM base AS production-deps
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
  && npm rebuild argon2

# Minimal runtime image.
FROM base AS runtime
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT??3000)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]

# One-shot image for `prisma migrate deploy` and optional seeding.
# It keeps the build dependencies so the Prisma CLI is available.
FROM build AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]
