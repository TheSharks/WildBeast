import type { ChatInputCommandErrorPayload } from "@sapphire/framework";
import { Listener } from "@sapphire/framework";

export class CommandErrorListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: "chatInputCommandError",
    });
  }

  public run(payload: ChatInputCommandErrorPayload) {
    const analytics = this.container.analytics;
    if (!analytics) return;

    const shardId = this.container.client.shard?.ids[0] ?? 0;

    const errorCounter = analytics.counter(
      "discord_command_errors_total",
      "Total number of Discord command errors",
    );

    errorCounter.inc(1, {
      command: payload.command.name,
      guild_id: payload.interaction.guildId || "dm",
      shard_id: shardId.toString(),
      //error_type: payload.error.name || 'UnknownError'
    });
  }
}
