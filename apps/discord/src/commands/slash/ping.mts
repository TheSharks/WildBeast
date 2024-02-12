import { isMessageInstance } from "@sapphire/discord.js-utilities";
import { Command } from "@sapphire/framework";
import { applyLocalizedBuilder, resolveKey } from "@sapphire/plugin-i18next";

export class PingCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        applyLocalizedBuilder(
          builder,
          "commands/names:ping",
          "commands/descriptions:ping",
        );
      },
      {
        guildIds: ["1034462346908794910"],
        idHints: ["1071139291897548902"],
      },
    );
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const msg = await interaction.reply({
      content: (await resolveKey(
        interaction,
        "commands/ping:success",
      )) as string,
      ephemeral: true,
      fetchReply: true,
    });

    if (isMessageInstance(msg)) {
      const diff = msg.createdTimestamp - interaction.createdTimestamp;
      const ping = Math.round(this.container.client.ws.ping);
      return interaction.editReply(
        await resolveKey(interaction, "commands/ping:success_with_args", {
          diff,
          ping,
        }),
      );
    }

    return interaction.editReply(
      await resolveKey(interaction, "commands/ping:failed"),
    );
  }
}
