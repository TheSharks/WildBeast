import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import { Events, type Guild } from 'discord.js'

// Joins and leaves go to Sentry metrics rather than OTel: the OTel side
// already gauges the fleet-wide totals every minute (discord_guilds_total),
// while these are rare discrete events where the per-item model shines —
// each data point keeps the guild's size and shard for inspection without
// creating a per-guild metric series.

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
