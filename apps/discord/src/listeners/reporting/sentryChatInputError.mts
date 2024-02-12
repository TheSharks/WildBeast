import { ApplyOptions } from "@sapphire/decorators";
import type { ListenerOptions } from "@sapphire/framework";
import { Events, Listener } from "@sapphire/framework";
import { resolveKey } from "@sapphire/plugin-i18next";
import * as Sentry from "@sentry/node";
import { Colors, EmbedBuilder, type ClientEvents } from "discord.js";

@ApplyOptions<ListenerOptions>({
  event: Events.ChatInputCommandError,
})
export class SentryChatInputErrorListener extends Listener {
  public async run(...[error, payload]: ClientEvents["chatInputCommandError"]) {
    Sentry.addBreadcrumb({
      category: "command",
      data: {
        payload,
      },
      level: "error",
      message: error instanceof Error ? error.message : String(error),
    });
    const uuid = Sentry.captureException(error);
    const embeds = [
      new EmbedBuilder()
        .setTitle(await resolveKey(payload.interaction, "system/errors:oops"))
        .setDescription(
          await resolveKey(payload.interaction, "system/errors:try_again", {
            error: (error as Error).message,
          }),
        )
        .setColor(Colors.Red)
        .setFooter({
          text: await resolveKey(payload.interaction, "system/errors:report"),
        })
        .addFields({
          name: await resolveKey(
            payload.interaction,
            "system/errors:error_code",
          ),
          value: uuid,
        }),
    ];
    if (payload.interaction.replied) {
      payload.interaction.editReply({
        content: "",
        components: [],
        embeds,
      });
    } else {
      payload.interaction.reply({
        embeds,
        ephemeral: true,
      });
    }
  }
}
