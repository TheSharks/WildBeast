import { ApplyOptions } from "@sapphire/decorators";
import type { ListenerOptions } from "@sapphire/framework";
import { Events, Listener } from "@sapphire/framework";
import type { ClientEvents } from "discord.js";
import { inspect } from "node:util";

@ApplyOptions<ListenerOptions>({
  event: Events.Raw,
})
export class LoggingRawListener extends Listener {
  public run(...[data]: ClientEvents["raw"]): void {
    this.container.logger.debug(inspect(data));
  }
}
