import type { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import { db, eq, isNotNull, tags } from '@thesharks/drizzle'
import type { Client } from 'discord.js'
import { limitFlagValue } from '../features/client.mjs'
import { taskFlagContext } from '../features/context.mjs'
import { tierForGuild } from '../premium/entitlements.mjs'
import { getLimit, limitFlagKey } from '../premium/limits.mjs'
import { TracedScheduledTask } from '../structures/task.mjs'
import {
  createGuildTagCommand,
  deleteGuildTagCommand,
  promotionsCounter,
  promotionsOverCap,
  reservedCommandNames,
  tagCommandName,
} from '../utils/guildTagCommands.mjs'

/**
 * Nightly reconciliation of promoted guild tag commands. Three jobs, in
 * order per guild:
 *
 * 1. Demote over-cap promotions, newest first. Promotion is blocked at the
 *    cap immediately, but an entitlement lapse leaves a guild over it; the
 *    daily cadence is the deliberate grace period so a billing hiccup or a
 *    stale entitlement mirror never insta-demotes a paying guild.
 * 2. Recreate commands the database says exist but Discord lacks.
 * 3. Delete guild commands of ours that no database row claims (e.g. a tag
 *    deletion whose REST cleanup failed).
 *
 * The dev guild is skipped: Sapphire's own registry bulk-overwrites its
 * command set on every boot, so promoted commands don't survive there
 * anyway and recreating them would fight that overwrite daily.
 */
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

    const guilds = await db
      .selectDistinct({ guildId: tags.guildId })
      .from(tags)
      .where(isNotNull(tags.commandId))

    let failures = 0
    for (const { guildId } of guilds) {
      if (guildId.toString() === process.env.WILDBEAST_DEV_GUILD_ID) continue
      try {
        await this.reconcileGuild(client, guildId)
      } catch (error) {
        // One guild's failure (kicked bot, permissions, rate limits) must
        // not abort the sweep.
        failures += 1
        this.container.logger.warn(
          `Could not reconcile guild tag commands for guild ${guildId}`,
          error,
        )
      }
    }
    if (failures > 0) {
      this.container.logger.warn(
        `Guild tag command reconciliation finished with ${failures} failed guild(s) of ${guilds.length}`,
      )
    }
  }

  private async reconcileGuild(client: Client<true>, guildId: bigint) {
    const cap = await this.capForGuild(guildId)
    const rows = await db.query.tags.findMany({
      where: eq(tags.guildId, guildId),
    })
    const promoted = rows.filter((row) => row.commandId !== null)
    const registered = await client.application.commands.fetch({
      guildId: guildId.toString(),
    })

    // Commands of ours that no row claims must go before anything else so
    // a recreate below can't race its own orphan cleanup.
    const claimed = new Set(
      promoted.map((row) => row.commandId?.toString() ?? ''),
    )
    for (const command of registered.values()) {
      if (claimed.has(command.id)) continue
      await deleteGuildTagCommand(
        client,
        guildId.toString(),
        BigInt(command.id),
      )
      promotionsCounter.add(1, { action: 'demote', trigger: 'orphanCleanup' })
    }

    const demote = new Set(promotionsOverCap(promoted, cap))
    for (const row of demote) {
      if (row.commandId === null) continue
      await deleteGuildTagCommand(client, guildId.toString(), row.commandId)
      await this.clearPromotion(row.id)
      promotionsCounter.add(1, { action: 'demote', trigger: 'reconcile' })
    }

    const reserved = reservedCommandNames()
    for (const row of promoted) {
      if (demote.has(row) || row.commandId === null) continue
      if (registered.has(row.commandId.toString())) continue

      // The stored name may have become invalid relative to current
      // reserved names (a new bot command); demote rather than recreate.
      const name = tagCommandName(row.name, reserved)
      if (!name.ok) {
        await this.clearPromotion(row.id)
        promotionsCounter.add(1, { action: 'demote', trigger: 'reconcile' })
        continue
      }

      const commandId = await createGuildTagCommand(
        client,
        guildId.toString(),
        name.name,
        row.commandDescription ?? `Tag "${row.name}" from this server`,
      )
      await db.update(tags).set({ commandId }).where(eq(tags.id, row.id))
      promotionsCounter.add(1, { action: 'promote', trigger: 'reconcile' })
    }
  }

  /**
   * The guild's promoted-command cap: the registry value for its mirrored
   * tier, overridable through the same `limits.*` flag interactions use —
   * without honoring the override here, reconciliation would demote guilds
   * an operator deliberately raised.
   */
  private async capForGuild(guildId: bigint): Promise<number> {
    const tier = await tierForGuild(guildId)
    return limitFlagValue(
      limitFlagKey('tags.maxPromotedPerGuild'),
      getLimit('tags.maxPromotedPerGuild', tier),
      {
        ...taskFlagContext(this.name),
        targetingKey: guildId.toString(),
        guildId: guildId.toString(),
        tier,
      },
    )
  }

  private async clearPromotion(tagId: number) {
    await db
      .update(tags)
      .set({
        commandId: null,
        commandDescription: null,
        promotedBy: null,
        promotedAt: null,
      })
      .where(eq(tags.id, tagId))
  }
}
