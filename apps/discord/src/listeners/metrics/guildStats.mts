import { Listener } from "@sapphire/framework";
import { Events } from "discord.js";

function updateGuildMetrics(listener: Listener) {
  const analytics = listener.container.analytics;
  if (!analytics) return;

  const shardId = listener.container.client.shard?.ids[0] ?? 0;
  const shardLabels = { shard_id: shardId.toString() };

  const guildGauge = analytics.gauge(
    "discord_guilds_total",
    "Total number of Discord guilds the bot is in",
  );

  const userGauge = analytics.gauge(
    "discord_users_total",
    "Total number of Discord users the bot can see",
  );

  const guilds = listener.container.client.guilds.cache;
  const totalUsers = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);

  guildGauge.set(guilds.size, shardLabels);
  userGauge.set(totalUsers, shardLabels);
}

export class GuildStatsListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: Events.GuildCreate,
    });
  }

  public run() {
    updateGuildMetrics(this);
  }
}

export class GuildLeaveListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: Events.GuildDelete,
    });
  }

  public run() {
    updateGuildMetrics(this);
  }
}
