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
  isTagCommandShape,
  promotionsCounter,
  promotionsOverCap,
  reservedCommandNames,
  tagCommandName,
} from '../utils/guildTagCommands.mjs'

// Task has no locale; en-US `tagOptionArgs` value for recreated commands.
const TAG_ARGS_DESCRIPTION_FALLBACK =
  'Space-separated arguments passed to the tag'

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
        // One guild's failure must not abort the sweep.
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

    // Orphan cleanup first so recreates can't race it.
    const claimed = new Set(
      promoted.map((row) => row.commandId?.toString() ?? ''),
    )
    for (const command of registered.values()) {
      if (claimed.has(command.id)) continue
      // Only tag-shaped commands; never touch others.
      if (!isTagCommandShape(command)) continue
      try {
        // In-flight promotes exist before the DB flips; re-read before deleting.
        const claimedRow = await db.query.tags.findFirst({
          where: eq(tags.commandId, BigInt(command.id)),
        })
        if (claimedRow && claimedRow.guildId === guildId) continue
        await deleteGuildTagCommand(
          client,
          guildId.toString(),
          BigInt(command.id),
        )
        promotionsCounter.add(1, { action: 'demote', trigger: 'orphanCleanup' })
      } catch (error) {
        this.container.logger.warn(
          `Could not delete orphaned guild command ${command.id} in guild ${guildId}`,
          error,
        )
        continue
      }
    }

    const demote = new Set(promotionsOverCap(promoted, cap))
    for (const row of demote) {
      if (row.commandId === null) continue
      try {
        await deleteGuildTagCommand(client, guildId.toString(), row.commandId)
        await this.clearPromotion(row.id)
        promotionsCounter.add(1, { action: 'demote', trigger: 'reconcile' })
      } catch (error) {
        this.container.logger.warn(
          `Could not demote over-cap tag ${row.name} in guild ${guildId}`,
          error,
        )
        continue
      }
    }

    const reserved = reservedCommandNames()
    for (const row of promoted) {
      if (demote.has(row) || row.commandId === null) continue
      if (registered.has(row.commandId.toString())) continue

      // Stored name may now collide with a new bot command; demote instead.
      const name = tagCommandName(row.name, reserved)
      if (!name.ok) {
        try {
          await this.clearPromotion(row.id)
          promotionsCounter.add(1, { action: 'demote', trigger: 'reconcile' })
        } catch (error) {
          this.container.logger.warn(
            `Could not demote invalid tag ${row.name} in guild ${guildId}`,
            error,
          )
        }
        continue
      }

      try {
        const commandId = await createGuildTagCommand(
          client,
          guildId.toString(),
          name.name,
          row.commandDescription ?? `Tag "${row.name}" from this server`,
          TAG_ARGS_DESCRIPTION_FALLBACK,
        )
        await db.update(tags).set({ commandId }).where(eq(tags.id, row.id))
        promotionsCounter.add(1, { action: 'promote', trigger: 'reconcile' })
      } catch (error) {
        this.container.logger.warn(
          `Could not recreate guild command for tag ${row.name} in guild ${guildId}`,
          error,
        )
        continue
      }
    }
  }

  // Guild cap honoring the same `limits.*` override enforcement uses, so operators aren't demoted.
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
