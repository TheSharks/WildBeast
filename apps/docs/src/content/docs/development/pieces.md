---
title: Writing pieces
description: Adding commands, listeners, and scheduled tasks.
sidebar:
  order: 3
---

Commands, listeners, and scheduled tasks are all Sapphire **pieces**: classes
in the right directory that the framework discovers and loads automatically.
You add one by dropping a file in; there is no registry to wire it into.

Two project conventions sit on top of Sapphire's defaults, and both matter:

- **Commands and scheduled tasks extend a traced base class**, not Sapphire's
  directly, so every run is captured as a span and an isolated Sentry scope.
- **A piece's name defaults to its file name, and names must be unique.**
  Sapphire silently unloads a piece whose name collides with one already
  loaded. A [structure test](/development/testing/) asserts that every
  exported piece actually registers, which catches this, but it is the single
  easiest mistake to make.

## Commands

Extend `TracedCommand` from `structures/command.mjs`. Override the Sapphire
handlers (`chatInputRun`, `contextMenuRun`) exactly as normal; the base class
wraps whichever ones you define in a span named `discord.command.<name>`, so
any database or HTTP call inside nests underneath automatically.

```ts
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import { TracedCommand } from '../../structures/command.mjs'

export class PingCommand extends TracedCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:ping',
        'commands/descriptions:ping',
      )
    })
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    return interaction.reply(await resolveKey(interaction, 'commands/ping:success'))
  }
}
```

Commands live under `commands/`, loaded recursively; the `slash/`
subdirectory is organization, not a requirement. User-facing strings come from
i18next, never inline (see [Localization](#localization)). During a command
you can reach shared services through `this.container` (`client`, `logger`).

## Listeners

Listeners extend Sapphire's `Listener` directly and are not traced, since
they react to events rather than serving a user request. Set the `event` and,
when listening to something other than the client, the `emitter`. A string
emitter is resolved against the client, so `'rest'` binds to `client.rest`.

```ts
import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { RESTEvents } from 'discord.js'

@ApplyOptions<ListenerOptions>({ emitter: 'rest', event: RESTEvents.RateLimited })
export class RestRateLimitedListener extends Listener {
  public run(/* event payload */) {
    // ...
  }
}
```

Group listeners by intent under `listeners/` (`metrics/`, `logging/`,
`reporting/`); the subdirectory is cosmetic. To emit a metric, pull a meter
from `@thesharks/analytics` at module scope and record inside `run`; the
existing metrics listeners are the pattern to copy.

## Scheduled tasks

Extend `TracedScheduledTask` from `structures/task.mjs` and set a schedule,
either an `interval` in milliseconds or a `pattern` (cron). The base class wraps
`run` in a `discord.task.<name>` span, and when the schedule is expressible as
a Sentry monitor (a cron pattern, or a whole-minute interval) it also reports
[cron check-ins](/observability/telemetry/#sentry), so a run that never
happens alerts like one that throws.

```ts
import type { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import { TracedScheduledTask } from '../structures/task.mjs'

export class MetricsCollectionTask extends TracedScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, { ...options, interval: 60_000 })
  }

  public run() {
    // ...
  }
}
```

Tasks are backed by a BullMQ queue on Redis, so a recurring job runs on
exactly one worker across the whole fleet, so collecting per-cluster stats
needs no deduplication. Give the task's module augmentation entry a `never` payload
type if it takes no payload, matching the existing tasks.

## Localization

The bot speaks through [i18next](https://www.i18next.com/) via
`@sapphire/plugin-i18next`; user-facing text is never hard-coded. Translation
files live under `languages/<locale>/`, addressed as `namespace:key` where the
namespace is the file path:

- `applyLocalizedBuilder(builder, 'commands/names:ping', 'commands/descriptions:ping')`
  localizes a command's name and description at registration.
- `resolveKey(interaction, 'commands/ping:success', { diff, ping })` resolves a
  string for a reply, interpolating `{{diff}}` / `{{ping}}` placeholders.

Add the English strings under `languages/en-US/`; other locales are managed
through [Crowdin](https://crowdin.com/project/wildbeast).

## Before you commit

Run `pnpm build && pnpm test`. The structure tests load your compiled piece
through a real Sapphire store and will fail if it doesn't register (a name
collision), if a listener has no resolvable emitter, or if a command or task
lost its tracing wrapper by not extending the traced base class.
