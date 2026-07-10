---
title: Upgrading from v8
description: What changed between WildBeast v8 and v9, and how to move an existing installation.
sidebar:
  order: 3
---

Version 9 is a ground-up rewrite of WildBeast: TypeScript on
[Sapphire](https://www.sapphirejs.dev/) and discord.js, organized as a pnpm
and Turborepo monorepo. It is not a drop-in upgrade. Treat it as a fresh
installation that reuses parts of your v8 configuration, and use this page
to see what carries over and what doesn't.

## New requirements

v9 needs more from its environment than v8 did:

- Node.js 22 or later and pnpm.
- PostgreSQL: `DATABASE_URL` is validated at boot, and the database backs
  the tag system and the premium entitlement mirror.
- Redis, even for a single cluster: it backs the scheduled task queue,
  identify rate limiting, and persisted gateway sessions.

[Getting started](/self-hosting/getting-started/) walks through a fresh
setup.

## Environment variables

`BOT_TOKEN` still works: v9 accepts it as a legacy alias for
`DISCORD_TOKEN`, so a copied v8 `.env` logs in unchanged. We recommend
renaming it, since the rest of the documentation refers to `DISCORD_TOKEN`.

WildBeast v9 no longer posts guild counts to third-party bot-listing
sites. The v8 `TOP_GG_TOKEN`, `BOTS_GG_TOKEN`, `DBL_COM_TOKEN`,
`ONDISCORD_XYZ_TOKEN`, and `DEL_XYZ_TOKEN` settings are intentionally
ignored; remove them, or run a separate listing-statistics publisher if
those listings still need periodic updates.

Everything else is new. The
[configuration reference](/self-hosting/configuration/) documents the full
set, including the clustering, premium, and telemetry variables that had no
v8 equivalent.

## Data

The database schema started as a carry-over of v8's, with one behavioral
change: tags are namespaced per guild, where v8 tags were global. Each
server now has its own tag list. See [Database](/development/database/)
for the schema and how migrations are applied.

## Commands

v9 speaks Discord slash commands only; the v8 prefix commands are gone.
The ported set is smaller than v8's and grows with each release. The
[command reference](/using/commands/) lists what's available today.
