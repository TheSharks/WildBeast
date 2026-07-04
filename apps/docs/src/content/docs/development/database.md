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
Nothing in the v9 bot queries the database yet. The schema below carries
over from v8 and backs the tag system as it's ported; the package exists so
new features land on a shared client from day one.
:::

## Current schema

Two tables, defined in `packages/drizzle/src/schema.ts`:

| Table | Columns | Purpose |
| --- | --- | --- |
| `Tag` | `id`, `name` (unique), `content`, `authorId` | Stored [TagScript](/tagscript/overview/) templates. |
| `Guild` | `id` | Guilds known to the bot. |

The schema module also exports inferred types (`Tag`, `NewTag`, `Guild`,
`NewGuild`) for use in application code.

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

## Next steps

- [Writing pieces](/development/pieces/) shows where database calls sit
  inside commands and tasks.
- [Development environment](/development/environment/) covers the
  devcontainer's PostgreSQL service.
