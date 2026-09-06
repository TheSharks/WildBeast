---
title: Premium subscriptions
description: Discord entitlements, premium tiers, the limit registry, and the entitlement mirror.
sidebar:
  order: 6
---

WildBeast monetizes through [Discord's premium app
subscriptions](https://docs.discord.com/developers/monetization/overview):
users buy a subscription inside Discord, Discord issues an **entitlement**,
and the bot maps that entitlement to a **tier** that controls what the
subscriber gets. The whole foundation lives in `apps/discord/src/premium/`;
nothing outside it hardcodes a tier-dependent number.

Discord sells two kinds of subscription, and the framework supports both:

- A **user subscription** follows the buyer everywhere: every guild and DM.
- A **guild subscription** benefits one guild and everyone acting in it.

An entitlement's own shape decides which kind it is (a guild subscription
carries a guild id, a user subscription doesn't); configuration can label
SKUs but never reclassifies what a purchase grants. A guild subscription
never raises a user's own limits, and a user subscription never raises a
guild's.

## Tiers

Tiers are a closed type in `premium/model.mts`, and their order lives in
`premium/limits.mts`:

```ts
export type Tier = 'free' | 'premium'
export const TIERS: readonly Tier[] = ['free', 'premium']
```

`free` is the baseline everyone has; `premium` is granted by an active
entitlement for a configured SKU. Adding a tier is one edit in each place;
the compiler then forces a value for the new tier on every limit in the
registry, so no cap can fall through to an accidental default.

## Configuration

One environment variable turns premium on:
[`WILDBEAST_PREMIUM_SKUS`](/self-hosting/configuration/#premium) maps SKU
ids from the developer portal's monetization tab to tiers, as
comma-separated `skuId:tier` or `skuId:tier:scope` entries:

```bash
WILDBEAST_PREMIUM_SKUS=1315790123456789:premium:guild
```

The optional scope (`user` or `guild`) states what kind of subscription the
SKU is sold as. Tier resolution never consults it; it exists so the purchase
button on a denial reply offers the SKU that matches the gate (see
[Gating commands](#gating-commands)). Unset means premium is off: everything
runs at the free tier and gated commands deny without a purchase button.
Malformed values fail [validation](/self-hosting/configuration/#validation-behavior)
at boot. The parsed catalog is part of `AppConfig` (`premiumSkus` for tier
resolution, `premiumCatalog` for upsells).

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
  'tags.maxPromotedPerGuild': {
    description: 'Tags a guild may promote to guild slash commands',
    scope: 'guild',
    values: { free: 2, premium: 25 },
  },
} as const satisfies Record<string, LimitDefinition>
```

Each limit declares whose subscription raises it:

| Scope | Meaning |
| --- | --- |
| `user` | Only the invoker's own subscription counts. |
| `guild` | Only the current guild's subscription counts; free tier in DMs. |

Enforcement never reads the registry directly. Services take a limits
collaborator and ask for the cap they need; `PremiumTagLimits`
(`premium/tag-limits.mts`) is the implementation the tag service uses:

```ts
// Inside TagService.create; the actor carries the interaction's grants.
const limit = await this.limits.forActor(actor, 'tags')
return this.repository.withGuild(actor.guildId, async (tags) => {
  if ((await tags.count()) >= limit) return { kind: 'limit', limit }
  // ...
})
```

`forActor` resolves the guild's tier from the grants Discord attached to
the interaction, looks the value up, applies any
[remote override](#remote-limit-overrides), and clamps the result to a sane
integer. The count and the insert happen under the guild's advisory lock,
so concurrent requests can't overshoot the cap. Adding a new limit is two
steps: add the registry entry, then ask for it at the enforcement site.

## Upselling when a limit is hit

A limit-reached reply offers the upgrade that raises the cap.
`premium/upsell.mts` centralizes the purchase button and takes the SKU
catalog explicitly:

```ts
import { upsellForLimit } from '../premium/upsell.mjs'

const subject = subjectFromInteraction(interaction)
return interaction.reply({
  content: limitReachedMessage,
  components: upsellForLimit(
    this.container.app.config.premiumCatalog,
    'tags.maxPerGuild',
    tierForSubject(this.container.app.premium, subject, 'guild'),
    subject.guildId,
  ),
})
```

`upsellForLimit` returns a premium-style button for the SKU granting the
lowest tier with a higher cap. It returns `undefined`, and the reply stays
informational, when nothing needs selling: the subject already holds the
best applicable tier, no higher tier raises this particular cap, or no
purchasable SKU is configured. The same rule keeps a premium guild at its
premium cap from ever seeing a purchase button, and keeps guild SKUs out of
DM replies.

The whole-command variant, `premiumUpsellComponents(catalog, tier, scope,
guildId)`, backs the `Premium` precondition's denial reply and takes the
target tier directly.

## Resolving tiers

With an interaction at hand, resolution is synchronous and needs no
database: Discord attaches every applicable active entitlement (the
invoker's user subscriptions and the guild's subscriptions) to each
interaction. `premium/interaction.mts` turns that into a subject:

```ts
const subject = subjectFromInteraction(interaction)
// { userId, guildId, grants }

tierForSubject(premium, subject, 'user')  // the invoker's own subscriptions
tierForSubject(premium, subject, 'guild') // the current guild's subscriptions
tierForSubject(premium, subject, 'any')   // the best of either
```

`any` is for flag targeting and display only. Limits and gates always use
the scope the limit or command declares, which is what keeps a user
subscription from lifting a guild cap.

Outside interactions (scheduled tasks, background repair), there's no
interaction to read grants from. `PremiumService.forBackground(scope, id)`
answers from the [entitlement mirror](#the-entitlement-mirror) instead, and
returns more than a tier:

| Field | Meaning |
| --- | --- |
| `tier` | The tier the mirror grants right now. |
| `freshness` | `fresh`, `stale`, `never-synced`, or `invalid-clock`, judged from the last completed full snapshot. |
| `mayRevoke` | `true` only when the snapshot is fresh. An expired or deleted row is not proof that a different grant is absent. |
| `validUntil` | When a fresh decision stops being fresh, so long-running work can re-check. |

The freshness window is 24 hours. Background code that removes something
from a guild (demoting over-cap promotions, for example) must check
`mayRevoke` first; granting is always safe.

## Gating commands

Limits keep a feature usable on the free tier with a cap. To require a
subscription for a whole command, set `premium` on the piece:

```ts
@ApplyOptions<AppCommandOptions>({
  premium: { tier: 'premium', scope: 'guild' },
})
```

`tier` defaults to `premium` and `scope` to `any` (either kind of
subscription satisfies the gate); a `guild` gate always denies in DMs. The
base class appends the `Premium` precondition and registers the requirement
with the shared [gates](/development/features/#command-and-task-gates), so
autocomplete and component handlers for that command apply it too. When the
precondition denies, the reply listener answers with the localized
`system/errors:premium_required` message, a scope-aware explanation, and
(when a configured SKU matches the gate's scope) a premium-style button that
opens Discord's purchase flow.

## The entitlement mirror

Interaction-time checks never touch the database, but scheduled tasks have
no interaction to read entitlements from. For those, the `Entitlement`
[table](/development/database/#current-schema) mirrors Discord's
entitlements locally, and `EntitlementMirrorState` records how trustworthy
that mirror is.

Two writers keep the mirror current:

- Listeners in `listeners/premium/entitlementEvents.mts` write every
  entitlement create, update, and delete the gateway delivers. Deletes
  (refunds, test cleanup) are soft: the row keeps its history and a
  `deleted` flag, matching Discord's own model.
- The `entitlementRefresh` task takes a full snapshot: it pages through
  every entitlement in the API (in both directions, because Discord's
  listing can start in the middle), then replaces the mirror in one
  transaction and records `completedAt`. It runs every six hours on the
  worker that owns shard 0, and the boot listener enqueues one run on every
  ClientReady so a restart never waits for the next interval.

The two writers can't clobber each other. Every change to the `Entitlement`
table advances a revision counter through a database trigger, and a snapshot
commits only if the revision it started from is unchanged. A gateway event
that lands mid-fetch wins; the snapshot reports itself as superseded and the
next run retries. Only a completed snapshot advances `completedAt`, and an
empty listing counts as completed, so a bot with no subscribers still knows
its mirror is fresh. A failed or interrupted fetch never publishes
freshness.

A failed mirror write only degrades background checks until the next event
or snapshot, so sync failures log a warning instead of throwing.

:::note
For local testing, the developer portal can issue test entitlements to your
own account or guild. They arrive with no expiry (`startsAt` and `endsAt`
both null) and behave like any other entitlement.
:::

## Promoted tag commands and entitlement lapse

`/tag promote` (capped by `tags.maxPromotedPerGuild`) creates real guild
slash commands, which raises the question of what happens when the
subscription that allowed 25 of them goes away. Promotion state is durable:
every promote or demote records a `TagCommandIntent` row first, and the
`TagReconciler` (`tags/reconciler.mts`) makes Discord match those intents.

- New promotions are blocked immediately; the limit check reads fresh
  entitlements from the interaction.
- Existing commands keep working until the nightly
  `guildTagCommandReconcile` task resolves the guild's cap through
  `forBackground`. If the mirror is fresh and the guild is over its cap, the
  newest promotions are demoted first until the guild fits again. If the
  mirror is stale, never synced, or unreadable, revocation waits and the run
  reports itself as deferred (`discord_guild_tag_reconcile_deferred_total`).

The daily cadence is the grace period: a billing hiccup or a stale mirror
never demotes a paying guild. The same run heals drift in both directions.
It recreates commands Discord lost, recovers a create whose response was
lost before the id was stored, and removes commands whose tag no longer
exists, and it only ever touches commands that an intent owns.

## Remote limit overrides

The registry values can be overridden at runtime through the same
[typed OFREP runtime policy](/development/features/) used for gates and
experiments. When configured, every limit lookup evaluates `limits.<key>`:
the registry entry for `tags.maxPerGuild` becomes the flag
`limits.tags.maxPerGuild`, with the tier's registry value as its default.

Evaluations carry a context the service can target rules at:

| Attribute | Value |
| --- | --- |
| `targetingKey` / `guildId` | The guild whose cap is being resolved. |
| `userId` | The invoker, for interaction-time lookups. |
| `tier` | The already-resolved premium tier, so rules can treat premium guilds differently. |
| `environment` | `NODE_ENV`, so staging can run different numbers than production. |

A rule matching none of these applies globally. The bot never depends on the
provider: when it's unconfigured, down, slow, or has no matching flag, the
tier's registry value applies. An override that isn't a non-negative integer
at or below 10,000 is rejected, logged, and counted
(`discord_premium_limit_override_fallbacks_total`), and the registry value
applies.

Evaluations are reported through the runtime-policy
[metrics and Sentry
integration](/development/features/#observability-and-tests).

## Next steps

- [Configuration](/self-hosting/configuration/#premium) lists the
  environment variable.
- [Database](/development/database/) covers the schema and migrations
  behind the mirror and the promotion intents.
- [Writing pieces](/development/pieces/) explains the listener and command
  conventions the premium pieces follow.
