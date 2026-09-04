---
title: Database
description: The PostgreSQL layer, Drizzle ORM, and how to change the schema.
sidebar:
  order: 4
---

Database access goes through the `@thesharks/drizzle` workspace package: a
[Drizzle ORM](https://orm.drizzle.team/) client over PostgreSQL. The rule
from the [contributing guidelines](https://github.com/TheSharks/WildBeast/blob/master/.github/CONTRIBUTING.md)
is absolute: never create your own database connection; import the client
and schema from the package.

```ts
import { db, tags } from '@thesharks/drizzle'
import { eq } from 'drizzle-orm'

const tag = await db.query.tags.findFirst({
  where: eq(tags.name, 'welcome'),
})
```

The connection string comes from `DATABASE_URL` (a standard
`postgres://user:password@host:port/database` URL). The
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
| `ApplicationCommandId` | `commandId`, `name`, `guildId` | Discord-assigned command ids, fed back to Sapphire as `idHints` on the next boot. |
| `Entitlement` | `id`, `skuId`, `userId`, `guildId`, `type`, `deleted`, `startsAt`, `endsAt` | Local mirror of Discord's [premium entitlements](/development/premium/#the-entitlement-mirror), for premium checks outside interactions. |

The schema module also exports inferred types (`Tag`, `NewTag`, `Guild`,
`NewGuild`, ...) for use in application code.

There are intentionally no foreign keys anywhere in the schema. Discord is
the source of truth for guilds, users, and entitlements, and rows must
survive references to guilds or users the bot has never seen (or that no
longer exist), so the database does not enforce their presence.

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
real guild id (serialized per guild with a transaction-scoped advisory
lock), so nothing live can touch `guildId = 0` while the cleanup runs.

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

While iterating locally you can use `pnpm --filter @thesharks/drizzle push`
to sync the schema directly without writing a migration, and `... studio`
opens Drizzle Studio, a browser UI over the database. Both are development
conveniences; anything that merges needs a real migration.

Migrations are forward-only: there is no down-migration support, so
rolling back a schema change means writing a new migration that undoes it.
The bot also never migrates on boot — production fleets apply migrations
explicitly with `pnpm --filter @thesharks/drizzle migrate` before rolling
the clusters (see [Running in
production](/self-hosting/running-in-production/#database-migrations)),
because clusters start at different times and must all observe the same
schema.

## Next steps

- [Writing pieces](/development/pieces/) shows where database calls sit
  inside commands and tasks.
- [Development environment](/development/environment/) covers the
  devcontainer's PostgreSQL service.
