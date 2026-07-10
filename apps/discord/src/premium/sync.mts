import {
  db,
  entitlements,
  type NewEntitlement,
  notInArray,
} from '@thesharks/drizzle'
import type { Client, Entitlement as DiscordEntitlement } from 'discord.js'

const FETCH_PAGE_SIZE = 100

type EntitlementCursor = 'before' | 'after'

/** Map a gateway entitlement to its database mirror row. */
export function entitlementRow(
  entitlement: DiscordEntitlement,
): NewEntitlement {
  return {
    id: BigInt(entitlement.id),
    skuId: BigInt(entitlement.skuId),
    userId: entitlement.userId ? BigInt(entitlement.userId) : null,
    guildId: entitlement.guildId ? BigInt(entitlement.guildId) : null,
    type: entitlement.type,
    deleted: entitlement.deleted,
    startsAt: entitlement.startsAt,
    endsAt: entitlement.endsAt,
  }
}

export async function upsertEntitlement(row: NewEntitlement): Promise<void> {
  const { id: _id, ...update } = row
  await db
    .insert(entitlements)
    .values(row)
    .onConflictDoUpdate({ target: entitlements.id, set: update })
}

/** Fetch every entitlement without assuming whether Discord's unbounded
 * first page is oldest-first or newest-first. A full first page is expanded
 * below its minimum id and above its maximum id; each cursor must make
 * strict progress or reconciliation aborts before its destructive phase. */
export async function fetchAllEntitlementRows(
  client: Client<true>,
): Promise<NewEntitlement[]> {
  const first = await client.application.entitlements.fetch({
    limit: FETCH_PAGE_SIZE,
    cache: false,
    excludeDeleted: false,
    excludeEnded: false,
  })
  const rows = new Map<bigint, NewEntitlement>()
  const add = (batch: typeof first) => {
    for (const entitlement of batch.values()) {
      const row = entitlementRow(entitlement)
      rows.set(row.id, row)
    }
  }
  add(first)
  if (first.size < FETCH_PAGE_SIZE) return [...rows.values()]

  const firstIds = [...first.keys()].map(BigInt)
  const walk = async (cursor: EntitlementCursor, initial: bigint) => {
    let boundary = initial
    for (;;) {
      const batch = await client.application.entitlements.fetch({
        limit: FETCH_PAGE_SIZE,
        [cursor]: boundary.toString(),
        cache: false,
        excludeDeleted: false,
        excludeEnded: false,
      })
      add(batch)
      if (batch.size < FETCH_PAGE_SIZE) return

      const ids = [...batch.keys()].map(BigInt)
      const next = cursor === 'before' ? minBigInt(ids) : maxBigInt(ids)
      const progressed = cursor === 'before' ? next < boundary : next > boundary
      if (!progressed) {
        throw new Error(
          `Entitlement pagination did not advance ${cursor} ${boundary}`,
        )
      }
      boundary = next
    }
  }

  await Promise.all([
    walk('before', minBigInt(firstIds)),
    walk('after', maxBigInt(firstIds)),
  ])
  return [...rows.values()]
}

function minBigInt(values: bigint[]): bigint {
  return values.reduce((minimum, value) => (value < minimum ? value : minimum))
}

function maxBigInt(values: bigint[]): bigint {
  return values.reduce((maximum, value) => (value > maximum ? value : maximum))
}

/**
 * Bring the local entitlement mirror in line with what Discord's API
 * reports: upsert everything the API returns and soft-delete rows it no
 * longer mentions (delete events missed while offline). Returns the number
 * of live entitlements. One reconcile per boot is enough — the gateway
 * listeners keep the mirror current afterwards.
 */
export async function reconcileEntitlements(
  client: Client<true>,
): Promise<number> {
  const rows = await fetchAllEntitlementRows(client)

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const { id: _id, ...update } = row
      await tx
        .insert(entitlements)
        .values(row)
        .onConflictDoUpdate({ target: entitlements.id, set: update })
    }
    // Anything the API didn't return no longer exists upstream. An empty
    // fetch means every mirrored entitlement is stale (no where clause).
    const ids = rows.map((row) => row.id)
    await tx
      .update(entitlements)
      .set({ deleted: true })
      .where(ids.length > 0 ? notInArray(entitlements.id, ids) : undefined)
  })

  return rows.filter((row) => !row.deleted).length
}
