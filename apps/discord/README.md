# WildBeast Discord bot

The Discord app of WildBeast (`@thesharks/discord`): a
[Sapphire](https://www.sapphirejs.dev/)/discord.js bot with slash commands,
scheduled tasks, and OpenTelemetry instrumentation. The entry point is the
cluster manager (`dist/cluster.mjs`), which runs every shard as a worker
thread (`dist/main.mjs`) inside one process.

## Commands

All commands are run from this directory (or via turbo from the repo root):

| Command      | Action                                        |
| ------------ | --------------------------------------------- |
| `pnpm dev`   | Build the workspace and run in watch mode     |
| `pnpm build` | Compile to `dist/`                            |
| `pnpm start` | Run the cluster manager (`node dist/cluster.mjs`) |
| `pnpm start:worker` | Run one shard worker directly (`node dist/main.mjs`) |
| `pnpm test`  | Run unit tests                                |

## Configuration

The bot reads its configuration from environment variables, loads
`apps/discord/.env` when present, and validates everything at boot. See the
[configuration reference](https://wildbeast.guide/self-hosting/configuration/).

## Documentation

Full documentation lives at [wildbeast.guide](https://wildbeast.guide/), in
particular the [architecture](https://wildbeast.guide/development/architecture/)
and [running in production](https://wildbeast.guide/self-hosting/running-in-production/)
pages.
