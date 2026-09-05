import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import { Events, type Guild } from 'discord.js'

// Sentry per-item metrics fit rare join/leave events; OTel already gauges totals.
// Labels frozen by SENTRY_METRIC_CONTRACT in
// packages/analytics/src/utils/metrics.ts.

function guildAttributes(guild: Guild) {
  return {
    shard_id: String(guild.shardId),
    member_count: guild.memberCount,
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'guildJoinedMetrics',
  event: Events.GuildCreate,
})
export class GuildJoinedMetricsListener extends Listener {
  public run(guild: Guild): void {
    Sentry.metrics.count('discord.guild.joined', 1, {
      attributes: guildAttributes(guild),
    })
    this.container.logger.info(
      `Joined guild ${guild.id} (${guild.memberCount} members)`,
    )
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'guildLeftMetrics',
  event: Events.GuildDelete,
})
export class GuildLeftMetricsListener extends Listener {
  public run(guild: Guild): void {
    Sentry.metrics.count('discord.guild.left', 1, {
      attributes: guildAttributes(guild),
    })
    this.container.logger.info(`Left guild ${guild.id}`)
  }
}
