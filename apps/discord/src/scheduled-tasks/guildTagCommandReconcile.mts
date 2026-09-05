import type { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import type { Client } from 'discord.js'
import { TracedScheduledTask } from '../structures/task.mjs'
import { TagCommands } from '../utils/tagService.mjs'

// Nightly per-guild jobs: demote over-cap newest-first (grace for billing hiccups), recreate missing, delete orphans.
// Skips the dev guild (Sapphire bulk-overwrites it every boot).
export class GuildTagCommandReconcileTask extends TracedScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, {
      ...options,
      pattern: '0 4 * * *',
    })
  }

  public async run() {
    const client = this.container.client as Client
    if (!client.isReady()) return

    // Thin delegate; sweep, caps, orphan scope, and grace live in the service.
    await TagCommands.reconcileAll(client)
  }
}
