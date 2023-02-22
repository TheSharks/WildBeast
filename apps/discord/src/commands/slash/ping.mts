import { ApplyOptions } from "@sapphire/decorators";
import { isMessageInstance } from "@sapphire/discord.js-utilities";
import { Command } from "@sapphire/framework";
import { resolveKey } from "@sapphire/plugin-i18next";
import { LocalizationMap } from "discord.js";

@ApplyOptions<Command.Options>({
  name: "ping",
  description: "Ping bot to see if it is alive",
})
export class PingCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        this.container.i18n.languages.forEach((value, key) => {
          builder.setNameLocalization(
            key as keyof LocalizationMap,
            value("ping:command_name")
          );
        });
        this.container.i18n.languages.forEach((value, key) => {
          builder.setDescriptionLocalization(
            key as keyof LocalizationMap,
            value("ping:command_description")
          );
        });
        builder //
          .setName(this.name)
          .setDescription(this.description);
      },
      {
        guildIds: ["1034462346908794910"],
        idHints: ["1071139291897548902"],
      }
    );
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const msg = await interaction.reply({
      content: (await resolveKey(interaction, "ping:success")) as string,
      ephemeral: true,
      fetchReply: true,
    });

    if (isMessageInstance(msg)) {
      const diff = msg.createdTimestamp - interaction.createdTimestamp;
      const ping = Math.round(this.container.client.ws.ping);
      return interaction.editReply(
        await resolveKey(interaction, "ping:success_with_args", {
          diff,
          ping,
        })
      );
    }

    return interaction.editReply(await resolveKey(interaction, "ping:failed"));
  }
}
