import { ApplyOptions } from "@sapphire/decorators";
import type { ListenerOptions } from "@sapphire/framework";
import { Events, Listener } from "@sapphire/framework";
import * as Sentry from "@sentry/node";

@ApplyOptions<ListenerOptions>({
  event: Events.ContextMenuCommandFinish,
})
export class SentryContextCommandFinishListener extends Listener {
  public run(): void {
    // clear user and extra data from Sentry
    Sentry.setUser(null);
    Sentry.setExtras({});
  }
}