import { ApplyOptions } from "@sapphire/decorators";
import { Events, Listener, ListenerOptions } from "@sapphire/framework";
import * as Sentry from "@thesharks/sentry";

@ApplyOptions<ListenerOptions>({
  event: Events.ChatInputCommandFinish,
})
export class ReadyListener extends Listener {
  public run(): void {
    // clear user and extra data from Sentry
    Sentry.setUser(null);
    Sentry.setExtras({});
  }
}
