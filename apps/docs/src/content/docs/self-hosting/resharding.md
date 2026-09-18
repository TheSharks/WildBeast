---
title: Changing the shard total
description: Migrating the fleet to a new shard count with a rolling deploy.
sidebar:
  order: 7
---

Use this guide to change the number of shards in an autonomous fleet. If
you're new to the process model, start with
[Sharding terminology](/self-hosting/clustering/#sharding-terminology).

The shard total decides which guilds land on which shard (`(guild_id >> 22) %
total`), so clusters running different totals must never serve at the same time.
WildBeast handles this with epochs. Each epoch is a generation of the fleet with
a fixed shard total and its own membership, leases, and sessions.

When `WILDBEAST_SHARDING_TOTAL` is unset, Discord's recommendation initializes
the total only for a new fleet. Existing fleets keep their stored total even
if the recommendation changes. Removing an explicit override adopts the
stored fleet state; it doesn't reset the total to Discord's recommendation.

## How a migration runs

In autonomous mode, change the total by rolling out a new
`WILDBEAST_SHARDING_TOTAL`:

1. Clusters restarted with the new total see that it differs from the active
   epoch and park as members of the next epoch. They log a warning and
   serve nothing yet (`discord_cluster_epoch_parked` reads 1).
2. Old-total clusters keep serving, absorbing shards from drained peers via
   normal rebalancing. Those remaining clusters must have enough capacity
   to serve the old shard total until they stop.
3. The moment the last old-total cluster is gone, one parked cluster
   atomically promotes the new epoch, and the parked fleet starts serving.
   Every shard identifies fresh, since sessions cannot cross shard totals.

The new epoch starts after the old fleet drains. Allow time for every new
shard to identify and become ready; finishing the deploy does not mean all
shards are already serving.

Automatically sized clusters already serving the old epoch must also be
restarted or stopped to drain it. Those starting while a migration is pending
join the pending epoch, without fetching a recommendation or proposing another
total. Roll out the explicit override first to establish that proposal.

## Failure handling

Configuration conflicts and expired proposals are handled as follows:

- A cluster restarted with a stale total after a migration remains parked,
  because the active epoch never drains while correctly configured
  clusters serve. Fix its configuration and redeploy it.
- Two different new totals proposed at once is a configuration error; the
  second proposal refuses to start with a message naming both totals while
  the first pending fleet is alive. Parked clusters refresh their proposal;
  if they all disappear, it expires after 45 seconds and a corrected rollout
  can propose a replacement without manually editing Redis keys.
- A parked fleet that outlives its own proposal (a Redis outage longer than
  45 seconds) re-claims it on the next poll and the migration continues. If
  a different total claimed the slot in the meantime, or was promoted under
  the epoch the cluster was waiting on, the cluster exits with an error
  naming both totals so the supervisor can restart it against the corrected
  configuration.
- A serving cluster left behind by a promotion (only possible if it was
  fenced off long enough for its membership to expire) notices the epoch
  moved, logs a fatal message, and exits so the supervisor can restart it.

## Choosing a total

Discord recommends roughly 1,000–2,500 guilds per shard, and large bots are
assigned a required multiple. Changing the total requires every shard to
identify again. Choose a total with capacity for expected growth. You can add
machines to an autonomous fleet without changing its shard total; increase the
total when individual shards need to serve fewer guilds.
