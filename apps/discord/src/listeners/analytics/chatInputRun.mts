import { ApplyOptions } from "@sapphire/decorators";
import type { ListenerOptions } from "@sapphire/framework";
import { Events, Listener } from "@sapphire/framework";
import type { ClientEvents } from "discord.js";
import { track } from "@thesharks/analytics";

@ApplyOptions<ListenerOptions>({
  event: Events.PreChatInputCommandRun,
})
export class AnalyticsChatInputRunListener extends Listener {
  public run(
    ...[{ interaction, command }]: ClientEvents["preChatInputCommandRun"]
  ): void {
    track("command_invocation", {
      command: interaction.commandName ?? command?.name,
      user_id: interaction.user.id,
      guild_id: interaction.guildId,
    });
  }
}