---
title: Database
description: The PostgreSQL layer, Drizzle ORM, and how to change the schema.
sidebar:
  order: 4
---

Database access goes through the `@thesharks/drizzle` workspace package: a
[Drizzle ORM](https://orm.drizzle.team/) client over PostgreSQL. The rule
from the [contributing guidelines](https://github.com/TheSharks/WildBeast/blob/master/.github/CONTRIBUTING.md)
is absolute: never create your own database connection; use the package's
client and schema.

In the bot, the runtime owns the connection. `composeApplication` opens one
pool with `createDatabase(url)`, checks that the schema is current, and
closes the pool during teardown after all admitted work has drained.
Application code never sees the pool: repositories in `adapters/` implement
the interfaces the services declare (`TagRepository`,
`EntitlementRepository`, `CommandIdRepository`) on top of it, and a piece
reaches them through the services on `this.container.app`.

```ts
// adapters/tags-postgres.mts
public async find(guildId: bigint, name: string) {
  return this.connection.db.query.tags.findFirst({
    where: and(eq(tags.guildId, guildId), eq(tags.name, name)),
  })
}
```

Scripts and tests that need a client without the runtime use the lazy `db`
export or `getDb()`, which read `DATABASE_URL` on first use. The connection
string is a standard `postgres://user:password@host:port/database` URL. The
[devcontainer](/development/environment/) sets it for you, pointing at its
TimescaleDB service.

:::note
The schema started as a v8 carry-over and currently backs the
[tag system](/using/commands/#tags) (now namespaced per guild, where v8
tags were global) and the
[premium entitlement mirror](/development/premium/#the-entitlement-mirror);
the package exists so new features land on a shared client from day one.
:::

## Extensions

The schema relies on two stock PostgreSQL contrib extensions, enabled by
the first migration (`CREATE EXTENSION IF NOT EXISTS`), so any user that
owns the database can apply it:

- **citext** makes `Tag.name` case-insensitive at the type level:
  `hello` and `Hello` are the same tag, in lookups and in the unique
  constraint.
- **pg_trgm** provides trigram matching. A GIN index on `Tag.name` backs
  substring autocomplete and the `similarity()`-based "did you mean"
  suggestion when a tag isn't found.

Both ship with every PostgreSQL distribution, including managed ones, so
they add no hosting constraints. The migration enables them itself with
`CREATE EXTENSION IF NOT EXISTS`, so there is nothing to set up by hand:
on managed providers (RDS, Cloud SQL, Azure, ...) both extensions are on
the allowlist and installable by the database owner.

## Current schema

The tables, defined in `packages/drizzle/src/schema.ts`:

| Table | Columns | Purpose |
| --- | --- | --- |
| `Tag` | `id`, `guildId`, `name` (citext, unique per guild), `content`, `authorId`, `commandId`, `commandDescription`, `promotedBy`, `promotedAt` | Stored [TagScript](/tagscript/overview/) templates, namespaced per guild. The nullable promotion columns track tags promoted to [guild slash commands](/development/premium/#promoted-tag-commands-and-entitlement-lapse). |
| `Guild` | `id` | Guilds known to the bot. |
| `TagCommandIntent` | `id`, `tagId`, `guildId`, `name`, `description`, `argsDescription`, `requestedBy`, `requestedAt`, `wanted`, `attempted`, `commandId` | Durable desired state for promoted commands. A promote request creates one, a demote or delete flips `wanted` off, and the reconciler makes Discord match. `attempted` records that a create was sent, so a lost response can be recovered instead of duplicated. |
| `ApplicationCommandId` | `commandId`, `name`, `guildId` | Discord-assigned command ids. Fed back to Sapphire as `idHints` on the next boot, and the record of where each [operator command](/development/pieces/#operator-commands) is placed. |
| `Entitlement` | `id`, `skuId`, `userId`, `guildId`, `type`, `deleted`, `startsAt`, `endsAt`, `updatedAt` | Local mirror of Discord's [premium entitlements](/development/premium/#the-entitlement-mirror), for premium checks outside interactions. Exactly one of `userId` and `guildId` is set. |
| `EntitlementMirrorState` | `id` (always 1), `revision`, `completedAt` | How trustworthy the mirror is. A trigger advances `revision` on every change to `Entitlement`; `completedAt` is the last full snapshot that committed against an unchanged revision. |

The schema module also exports inferred types (`Tag`, `NewTag`, `Guild`,
`NewGuild`, ...) for use in application code.

There are no foreign keys to Discord-owned identities. Discord is the source
of truth for guilds, users, and entitlements, and rows must survive
references to guilds or users the bot has never seen (or that no longer
exist), so the database doesn't enforce their presence. The one foreign key
is internal: `TagCommandIntent.tagId` references `Tag` with `ON DELETE SET
NULL`, so deleting a tag keeps the intent to remove its command.

## Legacy global tags (sentinel guild 0)

Before tags were namespaced per guild they were global, and the guild of an
existing tag cannot be reconstructed. Migration `0004` therefore kept those
rows under the unreachable sentinel guild `0` instead of failing the
deploy. Real guild ids are never `0`, so the bot never reads or writes
those rows. Once you have reviewed them, delete them:

```sql
-- Inspect first; these are pre-per-guild tags orphaned by the migration.
SELECT id, name FROM "Tag" WHERE "guildId" = 0;
-- Then remove them in one transaction.
BEGIN;
DELETE FROM "Tag" WHERE "guildId" = 0;
COMMIT;
```

No lock coordination with the bot is needed: tag writes always target a
real guild id (serialized per guild with a session advisory lock), so
nothing live can touch `guildId = 0` while the cleanup runs.

## Changing the schema

Schema changes live in the drizzle package, alongside a generated
migration, in the same pull request as the feature that needs them:

1. Edit `packages/drizzle/src/schema.ts`.
2. Generate a migration:

   ```bash
   pnpm --filter @thesharks/drizzle generate
   ```

   [drizzle-kit](https://orm.drizzle.team/docs/kit-overview) diffs the
   schema against the existing migrations and writes SQL to
   `packages/drizzle/drizzle/`.

3. Apply it to your development database:

   ```bash
   pnpm --filter @thesharks/drizzle migrate
   ```

Seeds, triggers, and data backfills can't be expressed in `schema.ts`.
Write those as custom migrations (`drizzle-kit generate --custom`) next to
the generated ones; migrations `0006`, `0007`, `0010`, and `0011` are the
existing examples.

While iterating locally you can use `pnpm --filter @thesharks/drizzle push`
to sync the schema directly without writing a migration, and `... studio`
opens Drizzle Studio, a browser UI over the database. Both are development
conveniences; anything that merges needs a real migration.

Migrations are forward-only: there is no down-migration support, so
rolling back a schema change means writing a new migration that undoes it.
The bot also never migrates on boot. Production fleets apply migrations
explicitly with `pnpm --filter @thesharks/drizzle migrate` before rolling
the clusters (see [Running in
production](/self-hosting/running-in-production/#database-migrations)),
because clusters start at different times and must all observe the same
schema. A worker checks for the current schema before it opens Redis or
logs in, and refuses to start against a database that predates it.

## Next steps

- [Writing pieces](/development/pieces/) shows where database calls sit
  inside commands and tasks.
- [Development environment](/development/environment/) covers the
  devcontainer's PostgreSQL service.
