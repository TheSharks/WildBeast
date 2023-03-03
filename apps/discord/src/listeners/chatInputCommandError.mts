import { ApplyOptions } from "@sapphire/decorators";
import { Events, Listener, ListenerOptions } from "@sapphire/framework";
import * as Sentry from "@thesharks/sentry";
import type { ClientEvents } from "discord.js";

@ApplyOptions<ListenerOptions>({
  event: Events.ChatInputCommandError,
})
export class ReadyListener extends Listener {
  public run(...[error, payload]: ClientEvents["chatInputCommandError"]): void {
    Sentry.addBreadcrumb({
      category: "command",
      data: {
        payload,
      },
      level: "error",
      message: (error as Error).message,
    });
    Sentry.captureException(error);
  }
}
