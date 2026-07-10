import {
  db,
  entitlements,
  type NewEntitlement,
  notInArray,
} from '@thesharks/drizzle'
import type { Client, Entitlement as DiscordEntitlement } from 'discord.js'

const FETCH_PAGE_SIZE = 100

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
  const rows: NewEntitlement[] = []
  let after: string | undefined
  for (;;) {
    const batch = await client.application.entitlements.fetch({
      limit: FETCH_PAGE_SIZE,
      after,
      cache: false,
      excludeDeleted: false,
      excludeEnded: false,
    })
    let cursor = 0n
    for (const entitlement of batch.values()) {
      rows.push(entitlementRow(entitlement))
      const id = BigInt(entitlement.id)
      if (id > cursor) cursor = id
    }
    if (batch.size < FETCH_PAGE_SIZE) break
    after = cursor.toString()
  }

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
