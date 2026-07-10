FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /workspace

# The Discord app consumes local workspace packages, so installation and
# compilation must run from the monorepo root. Build with:
#   docker build -f apps/discord/Dockerfile .
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/discord ./apps/discord
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @thesharks/discord... build
RUN pnpm --filter @thesharks/discord deploy --prod --legacy /prod/discord

FROM node:22-alpine AS runtime

ARG COMMIT
ENV GIT_COMMIT=$COMMIT \
    NODE_ENV=production
WORKDIR /usr/wildbeast

COPY --from=build /prod/discord ./

CMD ["node", "dist/cluster.mjs"]
