---
title: Writing pieces
description: Adding commands, listeners, and scheduled tasks.
sidebar:
  order: 3
---

Commands, listeners, interaction handlers, and scheduled tasks are all
Sapphire pieces. These are classes the framework discovers and loads from
their directories. Add a file to the matching directory, then register a
[runtime gate](/development/features/#command-and-task-gates) if the piece
is a command or scheduled task. For step-by-step recipes, see the
[command cookbook](/development/command-cookbook/).

Follow these project conventions when adding a piece:

- Commands and scheduled tasks extend an app base class, not Sapphire's
  directly. The base class admits every run through the runtime, captures
  it as a span with an isolated Sentry scope, and attaches the piece's gate.
- A piece's name defaults to its file name, and names must be unique.
  Sapphire silently unloads a piece whose name collides with one already
  loaded. The [structure test](/development/testing/) asserts that every
  exported piece registers and catches name collisions.
- Every command and task has a typed runtime gate. Add
  `features.commands.<name>` or `features.tasks.<name>` to the flag
  registry; the structure test fails when it's missing.

## Commands

Extend `AppCommand` from `structures/command.mjs`. Override the Sapphire
handlers `chatInputRun` and `contextMenuRun` as you would in Sapphire. The base
class wraps whichever ones you define in a span named `discord.command.<name>`,
so any database or HTTP call inside nests underneath.

```ts
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import { AppCommand } from '../structures/command.mjs'

export class PingCommand extends AppCommand {
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

Commands live under `commands/`. User-facing strings come from i18next,
never inline (see [Localization](#localization)). Inside a command you reach
shared services through `this.container.app`: `tags`, `premium`,
`tagLimits`, `flags`, `gates`, `experiments`, and `config`. Services take
typed arguments (`bigint` ids, a `TagActor`), never the interaction itself;
the command maps interaction fields in and outcomes out to replies.

A command with subcommands extends `AppSubcommand` from the same module,
built on `@sapphire/plugin-subcommands`. Declare the mapping from subcommand
name to method with `@ApplyOptions` and the same treatment applies, with the
matched subcommand recorded on the span. The tag command is the pattern to
copy.

Two options on the piece change how a command is gated and placed:

| Option | Effect |
| --- | --- |
| `premium: { tier, scope }` | Requires a subscription. The base class appends the `Premium` precondition and registers the requirement with the shared gates, so autocomplete and components are covered too. See [Gating commands](/development/premium/#gating-commands). |
| `scope: 'operator'` | Places the command only in operator guilds and restricts it to owners. See [Operator commands](#operator-commands). |

### Operator commands

Commands meant for the bot's operators, such as `/flags`, declare
`scope: 'operator'`. Nothing else changes in the piece: it still describes
its command in `registerApplicationCommands`. The base class then:

- Keeps the command out of Sapphire's registries entirely, so it's never
  registered globally or in the development guild.
- Appends the `OwnerOnly` precondition and restricts autocomplete to the
  owners in `WILDBEAST_OWNER_IDS`.
- Marks the command admin-only (`default_member_permissions: 0`), so only
  server admins see it in the picker.

The captured definition is placed per guild by the
`operatorCommandReconcile` task: into every guild in
`WILDBEAST_OPERATOR_GUILD_IDS` and the `operators.commandGuilds`
[runtime setting](/development/features/#settings), and removed from guilds
that leave that list. Placement uses per-command REST, so it never disturbs
promoted tag commands, and runs right after registries finish syncing and
then hourly. Members of other guilds never see the command.

### Registration

Never pass `idHints` or `guildIds` when registering; the base classes inject
both. Ids Discord assigned on previous boots are loaded from the database and
stored again after every registry sync, so Sapphire updates existing commands
instead of recreating them. Registration targets the guild from
`WILDBEAST_DEV_GUILD_ID` when set (instant updates during development) and is
global otherwise. The base classes apply this behavior to new commands
automatically.

## Message formatting

Replies are plain text or
[Components V2](https://docs.discord.com/developers/components/reference).
Embeds are the previous generation of message formatting; don't use
`EmbedBuilder` in new code. When a reply needs structure, a title, an accent
color, or separated fields, build a `ContainerBuilder` with text display
components and send it with the `IsComponentsV2` flag:

```ts
import {
  Colors,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
} from 'discord.js'

const container = new ContainerBuilder()
  .setAccentColor(Colors.Red)
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Heading\nBody text'),
  )

await interaction.reply({
  components: [container],
  flags: MessageFlags.IsComponentsV2,
})
```

Two constraints apply: a Components V2 message can't carry `content` or
`embeds` (clear both when editing an acknowledged reply into one), and the
flag can't be removed from a message once set. The `sendErrorReport` helper
in `telemetry/error-reply.mts` is a worked example.

## Interaction handlers

Component handlers (buttons, select menus) extend
`GatedCommandInteractionHandler` from `structures/interactionHandler.mjs`
and name the command that owns the component. A button can be clicked long
after its command ran, so the command's preconditions can't protect it; the
base class re-checks the command's gate and premium requirement through the
shared gates, admits the run through the runtime, and answers a localized
denial when the command is disabled. The `close` button handler, which only
removes buttons from an existing message, extends Sapphire's
`InteractionHandler` directly.

## Errors and denials

The listeners in `listeners/reporting/` answer the user when a command fails
or a precondition denies it, so pieces don't build those replies themselves.

- A command that throws is counted in `discord_command_errors_total` and
  captured in Sentry on an isolated scope. The user receives a generic
  message with an error code. The code is the Sentry event id, and the
  worker logs it next to the full error.
- A denied command is counted in `discord_command_denied_total` with the
  identifier of the precondition that denied it. Cooldowns and the
  `Feature`, `Premium`, and `OwnerOnly` preconditions have localized replies
  under `system/errors`; a premium denial adds a purchase button when a
  matching SKU is configured, and its scope explanation is English-only
  today. Any other precondition's message is sent as
  written. When you add a precondition, add a `system/errors` key and a
  branch in `describeDenial` (`listeners/reporting/commandDenied.mts`), and
  update the precondition list the structure test expects. A precondition
  can set `silent: true` in its error context to deny without a reply.
- Errors from listeners, interaction handlers, and command registration are
  counted in `framework_errors_total` and captured in Sentry. They produce
  no reply, which is why interaction handlers
  [catch their own failures](/development/command-cookbook/#add-a-button).

## Listeners

Listeners extend Sapphire's `Listener` directly. Set the `event` and, when
listening to something other than the client, the `emitter`. A string
emitter resolves against the client, so `'rest'` binds to `client.rest`.

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

Group listeners by purpose under `listeners/`. Subdirectories organize the
files but do not affect how Sapphire loads them.
Listeners that write to a service (the entitlement event listeners, for
example) run that write through `this.container.app.work.run(...)` so
draining waits for it. To emit a metric, pull a meter from
`@thesharks/analytics` at module scope and record inside `run`; the existing
metrics listeners are the pattern to copy.

## Scheduled tasks

Extend `AppScheduledTask` from `structures/task.mjs` and set a schedule,
either an `interval` in milliseconds or a `pattern` (cron). The base class
wraps `run` in a `discord.task.<name>` span, and when the schedule is
expressible as a Sentry monitor (a cron pattern, or a whole-minute interval)
it also reports [cron check-ins](/self-hosting/telemetry/#sentry), so a run
that never happens alerts like one that throws.

```ts
import type { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import { AppScheduledTask } from '../structures/task.mjs'

export class MetricsCollectionTask extends AppScheduledTask {
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

Each shard worker has a BullMQ queue on Redis. Recurring jobs run on every
worker unless they declare `requiresShard` (for example `requiresShard: 0`
for app-global maintenance). Only the owner registers those schedules.
A worker that is shutting down defers work for a retry on its own queue;
this counts as `status="deferred"` rather than an error. When creating a
one-off job, pass `TASK_JOB_OPTIONS` as `customJobOptions` to include retries;
the plugin doesn't copy the task's defaults for one-off jobs.
Every task also needs a
`features.tasks.<name>` gate in `features/registry.mts`, which the structure
test enforces. Give the task's module augmentation entry a `never` payload
type if it takes no payload, matching the existing tasks.

## Localization

The bot resolves translated strings through [i18next](https://www.i18next.com/)
via `@sapphire/plugin-i18next`; user-facing text is never hard-coded.
Translation files live under `languages/<locale>/`, addressed as
`namespace:key` where the namespace is the file path:

- `applyLocalizedBuilder(builder, 'commands/names:ping', 'commands/descriptions:ping')`
  localizes a command's name and description at registration.
- `resolveKey(interaction, 'commands/ping:success', { diff, ping })`
  resolves a string for a reply, interpolating `{{diff}}` and `{{ping}}`
  placeholders.

Add the English strings under `languages/en-US/`; other locales are managed
through [Crowdin](https://crowdin.com/project/wildbeast). A locale-drift
test checks that every key used in the source exists in `en-US`.

## Before you commit

Run `pnpm build && pnpm test`. The structure test loads your compiled piece
through a real Sapphire store and fails if it doesn't register (a name
collision), if a listener has no resolvable emitter, if a command or task
has no gate, or if a piece lost its wrapper by not extending the app base
class.

## Next steps

- The [command cookbook](/development/command-cookbook/) walks through adding
  a command, buttons, autocomplete, and a test.
- [Runtime flags and experiments](/development/features/) covers the gates
  every piece carries.
- [Testing](/development/testing/) shows how to test a command's replies
  against fake services.
