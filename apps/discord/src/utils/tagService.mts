import { container } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import {
  and,
  count,
  db,
  entitlements,
  eq,
  isNotNull,
  isNull,
  sql,
  type Tag,
  tags,
} from '@thesharks/drizzle'
import type { Client } from 'discord.js'
import { capForGuild } from '../premium/entitlements.mjs'
import {
  createGuildTagCommand,
  deleteGuildTagCommand,
  isTagCommandShape,
  promotionsCounter,
  promotionsOverCap,
  reservedCommandNames,
  tagCommandName,
} from './guildTagCommands.mjs'

const meter = metrics.getMeter('@thesharks/discord')
// Deferred over-cap demotions when the entitlement mirror can't prove the cap is fresh.
export const reconcileDeferCounter = meter.createCounter(
  'discord_guild_tag_reconcile_deferred_total',
  {
    description:
      'Guild tag reconciliations deferred on stale entitlement mirror',
  },
)

// Mirror older than this can't prove a guild is free; demotion waits for a fresh sync.
export const ENTITLEMENT_MIRROR_STALE_AFTER_MS = 24 * 60 * 60 * 1_000

// DB<->Discord invariant for promoted tags lives here; callers only map outcomes to replies.
//
// API:
// - promote(client, input): validate name, enforce cap, claim row (lock+tx, REST inside tx).
// - demote(client, input): re-read under lock, Discord-first delete, clear only if id matches.
// - reconcileGuild(client, guildId, opts?): orphan cleanup (tag-shape + re-read), over-cap
//   demote newest-first, recreate missing with name revalidation.
// - reconcileAll(client, opts?): distinct promoted guilds, dev-guild skip, per-guild isolation.
// - resolve(input): match by commandId + guild scope, with one in-flight re-read.
// - deleteCommand(client, guildId, commandId, trigger): REST delete + metric.
// - isDevGuild(guildId): dev-guild skip predicate shared with the sweep.
//
// Outcomes are machine-readable unions; i18n replies and upsells stay in callers.

// Task has no locale; en-US `tagOptionArgs` value for recreated commands.
export const TAG_ARGS_DESCRIPTION_FALLBACK =
  'Space-separated arguments passed to the tag'

export type PromoteOutcome =
  | 'promoted'
  | 'alreadyPromoted'
  | 'limit'
  | 'invalidName'
  | 'reserved'

export type DemoteOutcome = 'demoted' | 'notPromoted'

export type ResolveResult = { kind: 'hit'; tag: Tag } | { kind: 'miss' }

export interface ReconcileGuildStats {
  demoted: number
  recreated: number
  orphans: number
}

export interface ReconcileStats {
  guilds: number
  failures: number
}

export type DeleteTrigger =
  | 'command'
  | 'reconcile'
  | 'tagDelete'
  | 'orphanCleanup'

// Dev guild uses Sapphire bulk-overwrite every boot; reconciliation must not fight it.
export function isDevGuild(guildId: bigint): boolean {
  return guildId.toString() === process.env.WILDBEAST_DEV_GUILD_ID
}

export interface PromoteInput {
  guildId: string
  tagId: number
  tagName: string
  userId: string
  description: string
  argsDescription: string
  limit: number
  reserved?: Set<string>
}

// Claim a tag as a guild command; REST inside tx so failures roll the row back.
async function promote(
  client: Client<true>,
  input: PromoteInput,
): Promise<PromoteOutcome> {
  const name = tagCommandName(
    input.tagName,
    input.reserved ?? reservedCommandNames(),
  )
  if (!name.ok) return name.reason === 'reserved' ? 'reserved' : 'invalidName'

  const outcome = await db.transaction(async (tx) => {
    // Same per-guild serialization as tag creates; concurrent promotes can't overshoot the cap.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.guildId}, 0))`,
    )
    if (Number.isFinite(input.limit)) {
      const [held] = await tx
        .select({ value: count() })
        .from(tags)
        .where(
          and(
            eq(tags.guildId, BigInt(input.guildId)),
            isNotNull(tags.commandId),
          ),
        )
      if ((held?.value ?? 0) >= input.limit) return 'limit' as const
    }

    // Re-select under lock; a concurrent promote may have claimed it.
    const [fresh] = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.id, input.tagId), isNull(tags.commandId)))
    if (!fresh) return 'alreadyPromoted' as const

    const commandId = await createGuildTagCommand(
      client,
      input.guildId,
      name.name,
      input.description,
      input.argsDescription,
    )
    // Conditional update; a lost race affects zero rows instead of double-promoting.
    const updated = await tx
      .update(tags)
      .set({
        commandId,
        commandDescription: input.description,
        promotedBy: BigInt(input.userId),
        promotedAt: new Date(),
      })
      .where(and(eq(tags.id, input.tagId), isNull(tags.commandId)))
      .returning({ id: tags.id })
    if (updated.length === 0) {
      // Lost race after REST create (concurrent delete/demote zeroed the update); compensate so no orphan leaks.
      try {
        await deleteGuildTagCommand(client, input.guildId, commandId)
      } catch (error) {
        container.logger.warn(
          `Could not clean up orphaned guild command ${commandId} in guild ${input.guildId}`,
          error,
        )
      }
      return 'alreadyPromoted' as const
    }
    return 'promoted' as const
  })

  if (outcome === 'promoted') {
    promotionsCounter.add(1, { action: 'promote', trigger: 'command' })
  }
  return outcome
}

export interface DemoteInput {
  guildId: string
  tagId: number
  expectedCommandId: bigint
}

// Release a tag's guild command; Discord-first so failures keep a working promoted state.
async function demote(
  client: Client<true>,
  input: DemoteInput,
): Promise<DemoteOutcome> {
  const outcome = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.guildId}, 0))`,
    )
    // Re-read under lock; promotion may have changed concurrently.
    const [fresh] = await tx
      .select({ commandId: tags.commandId })
      .from(tags)
      .where(eq(tags.id, input.tagId))
    if (!fresh || fresh.commandId === null) return 'notPromoted' as const
    if (fresh.commandId !== input.expectedCommandId)
      return 'notPromoted' as const

    await deleteGuildTagCommand(client, input.guildId, input.expectedCommandId)
    // Clear only if the id still matches, so interleaved promotes survive.
    const cleared = await tx
      .update(tags)
      .set({
        commandId: null,
        commandDescription: null,
        promotedBy: null,
        promotedAt: null,
      })
      .where(
        and(
          eq(tags.id, input.tagId),
          eq(tags.commandId, input.expectedCommandId),
        ),
      )
      .returning({ id: tags.id })
    return cleared.length > 0 ? ('demoted' as const) : ('notPromoted' as const)
  })

  if (outcome === 'demoted') {
    promotionsCounter.add(1, { action: 'demote', trigger: 'command' })
  }
  return outcome
}

// Delete a promoted command; already-gone counts as success, metric keeps triggers aligned.
async function deleteCommand(
  client: Client<true>,
  guildId: string,
  commandId: bigint,
  trigger: DeleteTrigger,
): Promise<void> {
  await deleteGuildTagCommand(client, guildId, commandId)
  promotionsCounter.add(1, { action: 'demote', trigger })
}

// Match an unknown-command invocation to its tag; one re-read covers in-flight promotes.
async function resolve(input: {
  commandId: string
  guildId: string
}): Promise<ResolveResult> {
  const tag = await db.query.tags.findFirst({
    where: eq(tags.commandId, BigInt(input.commandId)),
  })
  // Never render a tag outside its own guild.
  if (tag && tag.guildId === BigInt(input.guildId)) return { kind: 'hit', tag }
  try {
    // In-flight promotes register before the DB flips; re-read once before orphan handling.
    const reread = await db.query.tags.findFirst({
      where: eq(tags.commandId, BigInt(input.commandId)),
    })
    if (reread && reread.guildId === BigInt(input.guildId)) {
      return { kind: 'hit', tag: reread }
    }
  } catch {
    // Fall through to miss on re-read failure.
  }
  return { kind: 'miss' }
}

async function clearPromotion(tagId: number): Promise<void> {
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

export interface ReconcileGuildOptions {
  cap?: number
  reserved?: Set<string>
  argsDescription?: string
}

// Mirror freshness for over-cap demotes; a guild with no row must not lose commands on stale data.
export async function shouldDeferOverCapDemotion(
  guildId: bigint,
): Promise<{ defer: boolean; reason?: string }> {
  try {
    const guildRows = await db
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(eq(entitlements.guildId, guildId))
      .limit(1)
    // Affirmative mirror row means the cap isn't based on absence; demotion is safe.
    if (guildRows.length > 0) return { defer: false }
    const [watermark] = await db
      .select({
        maxUpdatedAt: sql<Date | null>`max(${entitlements.updatedAt})`,
      })
      .from(entitlements)
    const max = watermark?.maxUpdatedAt ?? null
    // Empty mirror never synced; stale mirror may miss a payer's grant.
    if (max === null) return { defer: true, reason: 'empty-mirror' }
    if (Date.now() - max.getTime() > ENTITLEMENT_MIRROR_STALE_AFTER_MS) {
      return { defer: true, reason: 'stale-mirror' }
    }
    return { defer: false }
  } catch (error) {
    // Fail closed on watermark errors; never demote payers on unreadable mirror.
    container.logger.warn(
      `Deferring over-cap demotion for guild ${guildId}: entitlement watermark unreadable`,
      error,
    )
    return { defer: true, reason: 'watermark-error' }
  }
}

// Rebuild one guild's promoted set: orphans first (so recreates can't race them),
// then over-cap demotes newest-first (grace for billing hiccups), then recreates.
async function reconcileGuild(
  client: Client<true>,
  guildId: bigint,
  opts?: ReconcileGuildOptions,
): Promise<ReconcileGuildStats> {
  const cap = opts?.cap ?? (await capForGuild(guildId))
  const argsDescription = opts?.argsDescription ?? TAG_ARGS_DESCRIPTION_FALLBACK
  const reserved = opts?.reserved ?? reservedCommandNames()
  const rows = await db.query.tags.findMany({
    where: eq(tags.guildId, guildId),
  })
  const promoted = rows.filter((row) => row.commandId !== null)
  const registered = await client.application.commands.fetch({
    guildId: guildId.toString(),
  })
  const stats: ReconcileGuildStats = { demoted: 0, recreated: 0, orphans: 0 }

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
      await deleteCommand(
        client,
        guildId.toString(),
        BigInt(command.id),
        'orphanCleanup',
      )
      stats.orphans += 1
    } catch (error) {
      container.logger.warn(
        `Could not delete orphaned guild command ${command.id} in guild ${guildId}`,
        error,
      )
      continue
    }
  }

  const demote = new Set(promotionsOverCap(promoted, cap))
  if (demote.size > 0) {
    // Stale mirror demotes payers; skip over-cap demotes when freshness can't be proven.
    const decision = await shouldDeferOverCapDemotion(guildId)
    if (decision.defer) {
      container.logger.warn(
        `Deferring over-cap demotion for guild ${guildId}: entitlement mirror ${decision.reason}; keeping ${promoted.length} commands (cap ${cap})`,
      )
      try {
        reconcileDeferCounter.add(1, { reason: decision.reason ?? 'unknown' })
      } catch {
        // Metrics must never block reconciliation.
      }
      demote.clear()
    }
  }
  for (const row of demote) {
    if (row.commandId === null) continue
    try {
      await deleteGuildTagCommand(client, guildId.toString(), row.commandId)
      await clearPromotion(row.id)
      promotionsCounter.add(1, { action: 'demote', trigger: 'reconcile' })
      stats.demoted += 1
    } catch (error) {
      container.logger.warn(
        `Could not demote over-cap tag ${row.name} in guild ${guildId}`,
        error,
      )
      continue
    }
  }

  for (const row of promoted) {
    if (demote.has(row) || row.commandId === null) continue
    if (registered.has(row.commandId.toString())) continue

    // Stored name may now collide with a new bot command; demote instead.
    const name = tagCommandName(row.name, reserved)
    if (!name.ok) {
      try {
        await clearPromotion(row.id)
        promotionsCounter.add(1, { action: 'demote', trigger: 'reconcile' })
        stats.demoted += 1
      } catch (error) {
        container.logger.warn(
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
        argsDescription,
      )
      await db.update(tags).set({ commandId }).where(eq(tags.id, row.id))
      promotionsCounter.add(1, { action: 'promote', trigger: 'reconcile' })
      stats.recreated += 1
    } catch (error) {
      container.logger.warn(
        `Could not recreate guild command for tag ${row.name} in guild ${guildId}`,
        error,
      )
      continue
    }
  }

  return stats
}

export interface ReconcileAllOptions extends ReconcileGuildOptions {
  capFor?: (guildId: bigint) => Promise<number>
  listGuilds?: () => Promise<bigint[]>
}

// Nightly sweep across promoted guilds; one guild's failure never aborts the rest.
async function reconcileAll(
  client: Client<true>,
  opts?: ReconcileAllOptions,
): Promise<ReconcileStats> {
  const guildIds = opts?.listGuilds
    ? await opts.listGuilds()
    : (
        await db
          .selectDistinct({ guildId: tags.guildId })
          .from(tags)
          .where(isNotNull(tags.commandId))
      ).map((row) => row.guildId)

  let failures = 0
  for (const guildId of guildIds) {
    if (isDevGuild(guildId)) continue
    try {
      await reconcileGuild(client, guildId, {
        cap: opts?.capFor ? await opts.capFor(guildId) : opts?.cap,
        reserved: opts?.reserved,
        argsDescription: opts?.argsDescription,
      })
    } catch (error) {
      // One guild's failure must not abort the sweep.
      failures += 1
      container.logger.warn(
        `Could not reconcile guild tag commands for guild ${guildId}`,
        error,
      )
    }
  }
  if (failures > 0) {
    container.logger.warn(
      `Guild tag command reconciliation finished with ${failures} failed guild(s) of ${guildIds.length}`,
    )
  }
  return { guilds: guildIds.length, failures }
}

export const TagCommands = {
  promote,
  demote,
  resolve,
  deleteCommand,
  reconcileGuild,
  reconcileAll,
}
