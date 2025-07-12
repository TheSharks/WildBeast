import { ApplyOptions } from "@sapphire/decorators";
import type { ListenerOptions } from "@sapphire/framework";
import { Listener } from "@sapphire/framework";
import { ScheduledTaskEvents } from "@sapphire/plugin-scheduled-tasks";
import type { ClientEvents } from "discord.js";
import { track } from "@thesharks/analytics";

@ApplyOptions<ListenerOptions>({
  event: ScheduledTaskEvents.ScheduledTaskFinished,
})
export class AnalyticsTaskFinishedListener extends Listener {
  public run(...[task]: ClientEvents["scheduledTaskRun"]): void {
    track("scheduled_task_finished", {
      task: task.name,
      // include anything unique about the task if available
    });
  }
}