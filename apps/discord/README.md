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

## Interactive terminal

`pnpm start` opens a dashboard when stdin and stdout are interactive terminals.
Use `1`/`2`/`3` for overview, metrics, and logs; `/` to filter; arrows to inspect
metrics or scroll logs; `Space` to pause; and `?` for all controls. `q` returns to
plain logs while the bot continues running. `Ctrl+C` shuts the bot down gracefully.

Metrics come from the manager and its local shard workers through an independent
OpenTelemetry reader, so no collector is required. Set `WILDBEAST_TUI=off` to
keep plain logging. Non-interactive runs keep plain logging automatically.

See [the TUI package](../../packages/tui/README.md) for controls, data semantics,
and a standalone demo that works without bot credentials.

## Configuration

The bot reads its configuration from environment variables, loads
`apps/discord/.env` when present, and validates everything at boot. See the
[configuration reference](https://wildbeast.guide/self-hosting/configuration/).

## Documentation

Full documentation lives at [wildbeast.guide](https://wildbeast.guide/), in
particular the [architecture](https://wildbeast.guide/development/architecture/)
and [running in production](https://wildbeast.guide/self-hosting/running-in-production/)
pages.
