---
title: Premium subscriptions
description: Discord entitlements, premium tiers, and the limit registry.
sidebar:
  order: 6
---

WildBeast monetizes through [Discord's premium app
subscriptions](https://docs.discord.com/developers/monetization/overview):
users buy a subscription inside Discord, Discord issues an **entitlement**,
and the bot maps that entitlement to a **tier** that controls what the
subscriber gets. The whole foundation lives in
`apps/discord/src/premium/`; nothing outside it hardcodes a
tier-dependent number.

Discord sells two kinds of subscription, and the framework supports both:

- A **user subscription** follows the buyer everywhere: every guild and
  DM.
- A **guild subscription** benefits one guild and everyone acting in it.

An entitlement's own shape decides which kind it is (a guild subscription
carries a guild id, a user subscription doesn't); configuration can label
SKUs but never reclassify what a purchase actually grants.

## Tiers

Tiers are an ordered list in `premium/tiers.mts`, lowest first:

```ts
export const PREMIUM_TIERS = ['free', 'premium'] as const
```

`free` is the baseline everyone has; later entries are granted by active
entitlements. Adding a tier is one edit here; the compiler then forces a
value for the new tier on every limit in the registry, so no cap can fall
through to an accidental default.

## Configuration

One environment variable turns premium on:
[`WILDBEAST_PREMIUM_SKUS`](/self-hosting/configuration/#premium) maps SKU ids
from the developer portal's monetization tab to tiers, as comma-separated
`skuId:tier` or `skuId:tier:scope` entries:

```bash
WILDBEAST_PREMIUM_SKUS=1315790123456789:premium:guild
```

The optional scope (`user` or `guild`) states what kind of subscription
the SKU is sold as. Tier resolution never consults it (the entitlement
is authoritative); it exists so the purchase button on denial replies can
offer the SKU that matches the gate (see
[Gating commands](#gating-commands)). Unset means premium is off:
everything runs at the free tier and gated commands deny without a
purchase button. Malformed values fail
[validation](/self-hosting/configuration/#validation-behavior) at boot.

## The limit registry

Every subscription-controlled cap lives in one typed table in
`premium/limits.mts`, keyed `<feature>.<limit>`:

```ts
const registry = {
  'tags.maxPerGuild': {
    description: 'Tags a guild may hold',
    scope: 'guild',
    values: { free: 50, premium: 500 },
  },
} as const satisfies Record<string, LimitDefinition>
```

Each limit declares whose subscription raises it:

| Scope | Meaning |
| --- | --- |
| `user` | Only the invoker's own subscription counts. |
| `guild` | Only the current guild's subscription counts; free tier in DMs. |
| `any` | The best of both. The right choice for per-user caps that a guild subscription should also lift; a `user` limit can never be raised in a deployment that only sells guild subscriptions. |

`UNLIMITED` (`Infinity`) as a value removes the cap for that tier, which
is why enforcement checks `Number.isFinite` first. Commands read their
cap with `limitFor`, which resolves the invoker's tier by the limit's
scope and looks the value up in one call:

```ts
import { limitFor } from '../../premium/entitlements.mjs'

const limit = await limitFor(interaction, 'tags.maxPerGuild')
if (Number.isFinite(limit) && held >= limit) {
  // deny with a localized message
}
```

`/tag create` is the worked example. Adding a new limit is two steps: add
the registry entry, then check it at the enforcement site.

## Remote limit overrides

The registry values can be overridden at runtime through the same
[typed OFREP runtime policy](/development/features/) used for feature gates and
experiments. When configured, every `limitFor` call evaluates
`limits.<key>`: the registry entry for `tags.maxPerGuild` becomes the flag
`limits.tags.maxPerGuild`, with the tier's registry value as its default.

Evaluations carry a context the service can target rules at, so an
override can be as narrow or as broad as needed:

| Attribute | Value |
| --- | --- |
| `targetingKey` | The guild id, or the user id for `user`-scoped limits (and in DMs). |
| `guildId` | The guild the interaction happened in, when there is one. |
| `userId` | The invoker. |
| `tier` | The already-resolved premium tier, so rules can treat premium guilds differently. |
| `environment` | `NODE_ENV`, so staging can run different numbers than production. |

A rule matching none of these applies globally. The bot never depends on the
provider: when it is unconfigured, down, slow, or has no matching flag, the
tier's registry value applies.

Evaluations are reported through the runtime-policy
[metrics and Sentry integration](/development/features/#observability-and-tests).

## Resolving tiers

With an interaction at hand, resolution is synchronous and needs no
caching: Discord attaches every applicable active entitlement (the
invoker's user subscriptions and the guild's subscriptions) to each
interaction. `premium/entitlements.mts` exposes three views:

- `userTierForInteraction`: the invoker's own subscriptions.
- `guildTierForInteraction`: the current guild's subscriptions.
- `tierForInteraction`: the best of either.

Outside interactions (scheduled tasks, background jobs), `tierForUser`
and `tierForGuild` answer the same questions from the [entitlement
mirror](#the-entitlement-mirror) instead.

## Gating commands

Limits keep a feature usable on the free tier with a cap. To require a
subscription for a whole command, apply the `Premium`
[precondition](https://sapphirejs.dev/docs/Guide/preconditions/what-are-preconditions):

```ts
@ApplyOptions<Command.Options>({
  preconditions: [{ name: 'Premium', context: { tier: 'premium', scope: 'guild' } }],
})
```

`tier` defaults to `premium` and `scope` to `any` (either kind of
subscription satisfies the gate); a `guild` gate always denies in DMs.
When the precondition denies, the reply listener answers with the
localized `system/errors:premium_required` message and (when a
configured SKU matches the gate's scope) a premium-style button that
opens Discord's purchase flow.

## The entitlement mirror

Interaction-time checks never touch the database, but scheduled tasks
have no interaction to read entitlements from. For those, the
`Entitlement` [table](/development/database/#current-schema) mirrors
Discord's entitlements locally:

- Listeners in `listeners/premium/entitlementSync.mts` upsert every
  entitlement create, update, and delete the gateway delivers. Deletes
  (refunds, test cleanup) are soft: the row keeps its history and a
  `deleted` flag, matching Discord's own model.
- On boot, `listeners/premium/entitlementBackfill.mts` reconciles the
  mirror against the API once (entitlements are app-global, so only the
  worker holding shard 0 does this), catching anything granted or revoked
  while the bot was offline.

A failed mirror write only degrades background checks until the next
event or boot, so sync failures log a warning instead of throwing.

:::note
For local testing, the developer portal can issue test entitlements to
your own account or guild. They arrive with no expiry (`startsAt` and
`endsAt` both null) and behave like any other entitlement.
:::

## Next steps

- [Configuration](/self-hosting/configuration/#premium) lists the environment
  variable.
- [Database](/development/database/) covers the schema and migrations
  behind the mirror.
- [Writing pieces](/development/pieces/) explains the listener and
  command conventions the premium pieces follow.
