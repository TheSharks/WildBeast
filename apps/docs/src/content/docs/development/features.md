---
title: Runtime flags and experiments
description: Typed OFREP flags, command and task gates, settings, and experiment telemetry.
sidebar:
  order: 5
---

WildBeast uses [OpenFeature](https://openfeature.dev/) for runtime policy:
you can stop a feature, change a limit, move an operator command, or assign
an experiment variant without deploying the bot. An optional OFREP service
makes those decisions remotely. Without one, every evaluation uses its
in-code default and the bot behaves like a normal self-hosted installation.

Flags are operator-owned runtime controls. Persistent server preferences
belong in guild settings, and subscription benefits belong in the
[premium tier and limit registries](/development/premium/); don't model
either as a long-lived flag.

## The typed registry

Every gate, experiment, and setting is declared in `features/registry.mts`.
A definition carries its type and safe default alongside the metadata needed
to maintain it:

```ts
'features.commands.booru': {
  kind: 'gate',
  type: 'boolean',
  defaultValue: true,
  surface: 'command',
  description: 'Whether /booru may run',
  owner: 'discord',
  targets: ['environment', 'guild', 'user', 'tier', 'command'],
}
```

`FlagKey`, `GateFlagKey`, `ExperimentFlagKey`, `SettingFlagKey`, and each
experiment's variant type are inferred from this object. Feature code can't
evaluate a misspelled key or return an undeclared variant. Temporary
definitions can set an ISO `expiresAt` date; a worker warns at boot once
that date passes, so rollout flags don't become permanent configuration by
accident.

Numeric premium overrides stay defined by the typed
[limit registry](/development/premium/#the-limit-registry). Their OFREP keys
follow the same catalog convention: the limit `tags.maxPerGuild` is
evaluated as `limits.tags.maxPerGuild`.

## The flag service

Each shard worker owns one `FeatureFlags` instance (`features/flags.mts`),
built by the runtime with the configured provider and reachable from pieces
as `this.container.app.flags`. It exposes one method per registry kind
(`enabled` and `gate` for gates, `experiment`, `setting`, `limit`) and
attaches the worker's base context (`environment`, `clusterId`, `shardId`)
to every evaluation. Nothing else in the app talks to OpenFeature.

Two mechanisms keep flag lookups off the interaction's critical path:

- Caching: each flag and context resolution is reused for
  `WILDBEAST_OFREP_CACHE_TTL` seconds (default 30; `0` evaluates every
  time), and concurrent evaluations of the same flag and context share one
  in-flight request. Remote changes take up to the TTL to reach every
  worker. Cached answers appear in the evaluation metrics with source
  `cache`.
- A circuit breaker: an evaluation times out after two seconds and falls
  back to the in-code default, but during an outage every cold flag and
  context would pay that timeout. After three consecutive provider failures
  the service stops calling the provider for thirty seconds, serves the last
  good value when it has one, and otherwise serves the in-code default. A
  missing flag (`FLAG_NOT_FOUND`) isn't an outage and never trips it.

## Enabling remote evaluation

Point `WILDBEAST_OFREP_URL` at any service implementing OpenFeature's
[Remote Evaluation Protocol](https://openfeature.dev/specification/appendix-c/).
Set `WILDBEAST_OFREP_TOKEN` as well when the service expects a bearer token.
An unavailable or unconfigured provider returns the registry default rather
than preventing login or command execution.

Interaction evaluations send a consistent targeting context, built by
`CommandGates.flagContext` from the interaction's premium subject:

| Attribute | Value |
| --- | --- |
| `targetingKey` | The guild id, or the user id in DMs. |
| `guildId` / `userId` | The Discord server and invoker, when applicable. |
| `tier` | The best tier the invoker or guild holds, for targeting only. |
| `command` / `subcommand` | The application command being handled. |
| `shardId` / `clusterId` | The worker serving the interaction, when known. |
| `environment` | `NODE_ENV`, defaulting to `development`. |

Scheduled tasks use `task:<name>` as the targeting key and send `task`,
`environment`, and the available worker identity.

## Command and task gates

Every command has a default-on boolean key named
`features.commands.<piece-name>`. The command base classes attach the
`Feature` precondition, so a false evaluation keeps the slash command
registered but replies with a localized "temporarily unavailable" message.
Autocomplete and components are gated through the same `CommandGates`
service, because Sapphire doesn't run preconditions for them: a disabled
command returns no choices and its buttons answer with the same denial.

`CommandGates` (`features/gates.mts`) resolves both slices of a decision in
one call: whether the flag is on, and whether the invoker's or guild's tier
satisfies the command's premium requirement. Preconditions, autocomplete,
component handlers, and the denial reply all read from that one evaluation,
so a feature denial always wins over a premium denial and every surface
agrees.

Scheduled tasks use `features.tasks.<piece-name>`. A false value skips the
task body inside its normal trace and Sentry cron check-in. The run stays
healthy rather than producing a false missed-cron alert, while flag
evaluation metrics show that the gate resolved disabled.

Adding a command or task requires adding its key to the registry. The
structure test loads every compiled piece and fails when a piece has no
matching gate, so an unmanageable production feature can't slip in
silently.

Surfaces that run outside any Sapphire piece need a standalone gate.
`features.tags.guildCommands` is the worked example: promoted guild tag
commands arrive as unknown chat input interactions, so the listener
executing them evaluates that key itself before rendering anything.

## Settings

A setting is a free-form string an operator tunes at runtime. Unlike an
experiment it has no fixed variant list, and unlike a gate it's not a
switch. The registry declares it with `kind: 'setting'` and an in-code
default:

```ts
'operators.commandGuilds': {
  kind: 'setting',
  type: 'string',
  defaultValue: '',
  description: 'Comma-separated guild ids where operator commands are placed',
  owner: 'platform',
  targets: ['environment'],
}
```

`operators.commandGuilds` is the only setting today. The
`operatorCommandReconcile` task reads it, merges it with
`WILDBEAST_OPERATOR_GUILD_IDS`, and places every
[operator command](/development/pieces/#operator-commands) in exactly those
guilds, so you can add a support server without a restart.

## The /flags operator command

`/flags` gives operators live visibility into the whole flag surface without
touching the OFREP service. It's an operator-scoped command: it exists only
in the guilds listed in `WILDBEAST_OPERATOR_GUILD_IDS` and
`operators.commandGuilds`, only server admins see it there, and only the
owners in [`WILDBEAST_OWNER_IDS`](/self-hosting/configuration/#commands)
can run it (unset denies everyone).

`/flags list` evaluates every registered gate, experiment, and setting plus
every `limits.*` flag with the invoking interaction's context, and shows
each key with its value, evaluation source (`default`, `provider`, `cache`,
`error`), and expiry, with expired flags pinned to a warning section on top.
The optional `kind` option narrows the list. `/flags inspect key:<key>`
shows one flag in full: definition metadata, default, variants, and any
evaluation error.

Expired flags also feed the `discord_feature_flags_expired` gauge, so
dashboards and alerting see a forgotten temporary flag continuously rather
than only in a boot log line.

## Experiments

An experiment is a string flag whose allowed variants live in the registry:

```ts
'experiments.tags.notFoundReply': {
  kind: 'experiment',
  type: 'string',
  defaultValue: 'suggestion',
  variants: ['plain', 'suggestion'],
  surface: 'command',
  description: 'Whether a missing tag reply includes a suggestion',
  owner: 'discord',
  targets: ['environment', 'guild', 'user', 'tier', 'command'],
  expiresAt: '2027-01-31',
}
```

Resolve it at the point where the user is actually exposed, with the
context the gates build for the interaction:

```ts
const app = this.container.app
const variant = await app.experiments.variant(
  'experiments.tags.notFoundReply',
  app.gates.flagContext(subjectFromInteraction(interaction), {
    command: this.name,
    subcommand: interaction.options.getSubcommand(false) ?? undefined,
  }),
)

if (variant === 'suggestion') {
  // Build the suggestion reply.
}
```

The default variant must preserve current behavior. A provider value not
listed in `variants` is rejected in favor of that default and reported with
an `invalid` exposure source.

The command and task base classes open an experiment outcome scope around
each run. The first read of an experiment records one exposure; repeated
reads in the same run reuse that assignment without another OFREP call.
When the operation finishes, every exposed experiment receives a technical
`success` or `error` outcome. These outcomes measure runtime health by
variant; record product-specific conversions as separate events at their
actual conversion point.

## Observability and tests

Every evaluation reports its key, kind, source, duration, and boolean state
to OpenTelemetry. Experiment exposures and outcomes are separate counters;
see the
[metrics reference](/self-hosting/metrics/#runtime-flags-and-experiments).
Sentry error events also carry the flags evaluated in their isolated command
scope.

Use OpenFeature's `InMemoryProvider` in unit tests to exercise targeting
without running an OFREP service: construct a `FeatureFlags` with it, call
`open()`, and pass the instance to the service under test. Cover the in-code
default, each behavior branch, invalid remote values, and success or error
outcome attribution. The flag tests use `captureMetrics()` to verify the
exported series as well as the returned assignments.

## Next steps

- [Premium subscriptions](/development/premium/) covers the limit registry
  these flags can override.
- [Configuration](/self-hosting/configuration/#runtime-flags) lists the
  OFREP variables.
