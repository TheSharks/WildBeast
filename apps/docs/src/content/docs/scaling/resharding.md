---
title: Changing the shard total
description: Migrating the fleet to a new shard count with a rolling deploy.
sidebar:
  order: 2
---

The shard total decides which guilds land on which shard
(`(guild_id >> 22) % total`), so clusters running different totals must
never serve at the same time. WildBeast handles this with **epochs**: one
generation of the fleet with a fixed total, with all coordination state
(membership, leases, sessions) scoped to it.

## How a migration runs

Changing the total is just a rolling deploy with a new
`WILDBEAST_SHARDING_TOTAL`:

1. Clusters restarted with the new total see that it differs from the active
   epoch and **park** as members of the next epoch. They log a warning and
   serve nothing yet (`discord_cluster_epoch_parked` reads 1).
2. Old-total clusters keep serving, absorbing shards from drained peers via
   normal rebalancing, so there is no capacity gap during the rollout.
3. The moment the last old-total cluster is gone, one parked cluster
   atomically promotes the new epoch, and the parked fleet starts serving.
   Every shard identifies fresh, since sessions cannot cross shard totals.

The migration completes exactly when the deploy does. Mixed totals never
serve simultaneously, by construction.

## Failure handling

Every way a migration can go wrong parks safely rather than corrupting the
fleet:

- A cluster restarted with a stale total after a migration parks harmlessly
  forever, because the active epoch never drains while correctly configured
  clusters serve. Fix its configuration and redeploy it.
- Two different new totals proposed at once is a configuration error; the
  second proposal refuses to start with a message naming both totals while
  the first pending fleet is alive. Parked clusters refresh their proposal;
  if they all disappear, it expires after 45 seconds and a corrected rollout
  can propose a replacement without manual Redis surgery.
- A serving cluster left behind by a promotion (only possible if it was
  fenced off long enough for its membership to expire) notices the epoch
  moved, logs a fatal message, and exits so the supervisor can restart it.

## Choosing a total

Discord recommends roughly 1,000–2,500 guilds per shard, and large bots are
assigned a required multiple. Since changing the total costs a full
re-identify of the fleet, pick a value with headroom. The autonomous
cluster layer makes adding *machines* cheap, so the total only needs to
change when shards themselves get too heavy.
