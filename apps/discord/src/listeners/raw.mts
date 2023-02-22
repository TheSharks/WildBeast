import { ApplyOptions } from "@sapphire/decorators";
import { Events, Listener, ListenerOptions } from "@sapphire/framework";
import type { ClientEvents } from "discord.js";
import { inspect } from "node:util";

@ApplyOptions<ListenerOptions>({
  event: Events.Raw,
})
export class ReadyListener extends Listener {
  public run(...[data]: ClientEvents["raw"]): void {
    this.container.logger.debug(inspect(data));
  }
}
