import { ApplyOptions } from "@sapphire/decorators";
import { Events, Listener, ListenerOptions } from "@sapphire/framework";
import type { ClientEvents } from "discord.js";

@ApplyOptions<ListenerOptions>({
  event: Events.ClientReady,
})
export class ReadyListener extends Listener {
  public run(...[data]: ClientEvents["ready"]): void {
    this.container.logger.info(
      `Logged in as ${data.user.tag} (${data.user.id})`
    );
    this.container.logger.info(`Shards: ${data.shard?.count ?? 1}`);
    this.container.logger.info(`Guilds: ${data.guilds.cache.size}`);
    this.container.logger.info(`Users: ${data.users.cache.size}`);
  }
}
