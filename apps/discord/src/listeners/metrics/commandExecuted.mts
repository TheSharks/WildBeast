import type { ChatInputCommandSuccessPayload } from "@sapphire/framework";
import { Listener } from "@sapphire/framework";

export class CommandExecutedListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: "chatInputCommandSuccess",
    });
  }

  public run(payload: ChatInputCommandSuccessPayload) {
    const analytics = this.container.analytics;
    if (!analytics) return;

    const shardId = this.container.client.shard?.ids[0] ?? 0;

    const commandCounter = analytics.counter(
      "discord_commands_total",
      "Total number of Discord commands executed",
    );

    const executionTime = analytics.histogram(
      "discord_command_duration_seconds",
      "Time taken to execute Discord commands",
      [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    );

    commandCounter.inc(1, {
      command: payload.command.name,
      guild_id: payload.interaction.guildId || "dm",
      user_id: payload.interaction.user.id,
      shard_id: shardId.toString(),
    });

    const duration = Date.now() - payload.interaction.createdTimestamp;
    executionTime.observe(duration / 1000, {
      command: payload.command.name,
      guild_id: payload.interaction.guildId || "dm",
      shard_id: shardId.toString(),
    });
  }
}
