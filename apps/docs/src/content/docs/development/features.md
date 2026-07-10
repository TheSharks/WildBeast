---
title: Runtime flags and experiments
description: Typed OFREP flags, command and task gates, and experiment telemetry.
sidebar:
  order: 5
---

WildBeast uses [OpenFeature](https://openfeature.dev/) for runtime policy:
features can be stopped, limits can be changed, and experiments can assign a
variant without deploying the bot. An optional OFREP service makes those
decisions remotely. Without one, every evaluation uses its in-code default and
the bot behaves exactly like a normal self-hosted installation.

Flags are operator-owned runtime controls. Persistent server preferences belong
in guild settings, and subscription benefits belong in the
[premium tier and limit registries](/development/premium/); neither should be
modeled as a long-lived feature flag.

## The typed registry

Every gate and experiment is declared in `features/registry.mts`. A definition
contains its type and safe default alongside the metadata needed to maintain it:

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

`FlagKey`, `GateFlagKey`, `ExperimentFlagKey`, and each experiment's variant
type are inferred from this object. Feature code cannot evaluate a misspelled
key or return an undeclared variant. Temporary definitions can set an ISO
`expiresAt` date; a worker warns at boot once that date passes so rollout flags
do not become permanent configuration by accident.

Numeric premium overrides remain defined by the typed
[limit registry](/development/premium/#the-limit-registry). Their OFREP keys
follow the same catalog convention: the limit `tags.maxPerGuild` is evaluated
as `limits.tags.maxPerGuild`.

## Enabling remote evaluation

Point `WILDBEAST_OFREP_URL` at any service implementing OpenFeature's
[Remote Evaluation Protocol](https://openfeature.dev/specification/appendix-c/).
Set `WILDBEAST_OFREP_TOKEN` as well when the service expects a bearer token.
Each shard worker owns a client; an unavailable or unconfigured provider returns
the registry default rather than preventing login or command execution.

Interaction evaluations send a consistent targeting context:

| Attribute | Value |
| --- | --- |
| `targetingKey` | The guild id, or the user id in DMs and for user-scoped limits. |
| `guildId` / `userId` | The Discord server and invoker, when applicable. |
| `tier` | The invoker's already-resolved premium tier. |
| `command` / `subcommand` | The application command being handled. |
| `shardId` / `clusterId` | The worker serving the interaction, when known. |
| `environment` | `NODE_ENV`, defaulting to `development`. |

Scheduled tasks use `task:<name>` as the targeting key and send `task`,
`environment`, and the available worker identity.

## Command and task gates

Every command has a default-on boolean key named
`features.commands.<piece-name>`. The traced command base classes attach the
`Feature` precondition automatically, so a false evaluation keeps the slash
command registered but replies with a localized “temporarily unavailable”
message. Autocomplete is gated separately because Sapphire does not run command
preconditions for autocomplete interactions; a disabled command returns no
choices without querying Postgres or an external API.

Scheduled tasks use `features.tasks.<piece-name>`. A false value skips the task
body inside its normal trace and Sentry cron check-in. The run therefore remains
healthy rather than producing a false missed-cron alert, while flag evaluation
metrics show that the gate resolved disabled.

Adding a command or task requires adding its key to the registry. The framework
structure test loads every compiled piece and fails when a piece has no matching
gate, so an unmanageable production feature cannot slip in silently.

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

Resolve it at the point where the user is actually exposed:

```ts
const variant = await experimentVariant(
  'experiments.tags.notFoundReply',
  commandFlagContext(interaction, this.name),
)

if (variant === 'suggestion') {
  // Build the suggestion reply.
}
```

`commandFlagContext` (features/commandContext.mts) is the one way command
call sites build their targeting context — it resolves the tier and
subcommand so no call site can forget an attribute and silently stop
matching the service's rules.

The default variant should preserve current behavior. A provider value not
listed in `variants` is rejected in favor of that default and reported with an
`invalid` exposure source.

The traced command and task bases open an experiment outcome scope around each
run. The first read of an experiment records one exposure; repeated reads in the
same run reuse that assignment without another OFREP call. When the operation
finishes, every exposed experiment receives a technical `success` or `error`
outcome. These outcomes measure runtime health by variant; product-specific
conversions should be separate events at their actual conversion point.

## Observability and tests

Every evaluation reports its key, kind, source, duration, and boolean state to
OpenTelemetry. Experiment exposures and outcomes are separate counters; see the
[metrics reference](/observability/metrics/#runtime-flags-and-experiments).
Sentry error events also carry the flags evaluated in their isolated command
scope.

Use OpenFeature's `InMemoryProvider` in unit tests to exercise targeting without
running an OFREP service. Tests should cover the in-code default, each behavior
branch, invalid remote values, and success/error outcome attribution. The
runtime-policy tests use `captureMetrics()` to verify the exported series as
well as the returned assignments.
