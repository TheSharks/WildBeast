import { ApplyOptions } from "@sapphire/decorators";
import type { ListenerOptions } from "@sapphire/framework";
import { Listener } from "@sapphire/framework";
import { ScheduledTaskEvents } from "@sapphire/plugin-scheduled-tasks";
import type { ClientEvents } from "discord.js";

@ApplyOptions<ListenerOptions>({
  event: ScheduledTaskEvents.ScheduledTaskFinished,
})
export class LoggingReadyListener extends Listener {
  public run(...[task]: ClientEvents["scheduledTaskRun"]): void {
    this.container.logger.debug(`Task ${task.name} has finished.`);
  }
}
