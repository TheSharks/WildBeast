import { ApplyOptions } from "@sapphire/decorators";
import type { ListenerOptions } from "@sapphire/framework";
import { Events, Listener } from "@sapphire/framework";
import type { ClientEvents } from "discord.js";

@ApplyOptions<ListenerOptions>({
  event: Events.ClientReady,
})
export class LoggingReadyListener extends Listener {
  public run(...[data]: ClientEvents["ready"]): void {
    this.container.logger.info(
      `Ready! Logged in as ${data.user.tag} (${data.user.id})`,
    );
  }
}
