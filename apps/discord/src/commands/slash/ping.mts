import { ApplyOptions } from "@sapphire/decorators";
import { isMessageInstance } from "@sapphire/discord.js-utilities";
import { Command } from "@sapphire/framework";

@ApplyOptions<Command.Options>({
  name: "ping",
  description: "Ping bot to see if it is alive",
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
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
      content: `Ping?`,
      ephemeral: true,
      fetchReply: true,
    });

    if (isMessageInstance(msg)) {
      const diff = msg.createdTimestamp - interaction.createdTimestamp;
      const ping = Math.round(this.container.client.ws.ping);
      return interaction.editReply(
        `Pong 🏓! (Round trip took: ${diff}ms. Heartbeat: ${ping}ms.)`
      );
    }

    return interaction.editReply("Failed to retrieve ping :(");
  }
}
