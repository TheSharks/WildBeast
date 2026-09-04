import { container } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import {
  db,
  entitlements,
  type NewEntitlement,
  notInArray,
} from '@thesharks/drizzle'
import type { Client, Entitlement as DiscordEntitlement } from 'discord.js'

const FETCH_PAGE_SIZE = 100

const meter = metrics.getMeter('@thesharks/discord')
// Mirror reconciliations by outcome.
export const entitlementReconcileCounter = meter.createCounter(
  'discord_entitlement_reconcile_total',
  { description: 'Entitlement mirror reconciliations by result' },
)

function reconcileLogger() {
  try {
    return container.logger
  } catch {
    return undefined
  }
}

type EntitlementCursor = 'before' | 'after'

// Gateway entitlement to mirror row.
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

// Fetch all entitlements bidirectionally; abort before deletes unless each cursor strictly progresses.
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

// Mirror Discord's listing (upsert seen, soft-delete unseen); one boot-wide fetch/transaction race by design.
// TODO(entitlements): close it with a watermark re-fetch inside the transaction.
export async function reconcileEntitlements(
  client: Client<true>,
): Promise<number> {
  // Keep fetch and transaction back-to-back to narrow the snapshot window.
  const rows = await fetchAllEntitlementRows(client)

  if (rows.length === 0) {
    // Empty listing with non-empty mirror means failed-open fetch; never mass soft-delete here.
    const mirror = await db
      .select({ id: entitlements.id })
      .from(entitlements)
      .limit(1)
    if (mirror.length > 0) {
      try {
        entitlementReconcileCounter.add(1, { result: 'empty_aborted' })
      } catch {
        // Metrics must never break the guard.
      }
      reconcileLogger()?.warn(
        `Refusing to reconcile entitlements: API returned 0 rows while the mirror is non-empty; aborting before soft-delete`,
      )
      throw new Error(
        'Entitlement fetch returned no rows while the mirror is non-empty; aborting reconcile to avoid mass soft-delete',
      )
    }
    try {
      entitlementReconcileCounter.add(1, { result: 'ok_empty' })
    } catch {
      // ignore
    }
    reconcileLogger()?.info(
      'Entitlement mirror reconciled: 0 live entitlement(s), 0 soft-deleted (mirror already empty)',
    )
    return 0
  }

  let softDeleted = 0
  await db.transaction(async (tx) => {
    for (const row of rows) {
      const { id: _id, ...update } = row
      await tx
        .insert(entitlements)
        .values(row)
        .onConflictDoUpdate({ target: entitlements.id, set: update })
    }
    // Unreturned rows no longer exist upstream.
    const ids = rows.map((row) => row.id)
    const deleted = await tx
      .update(entitlements)
      .set({ deleted: true })
      .where(notInArray(entitlements.id, ids))
      .returning({ id: entitlements.id })
    softDeleted = deleted.length
  })

  const live = rows.filter((row) => !row.deleted).length
  try {
    entitlementReconcileCounter.add(1, { result: 'ok' })
  } catch {
    // ignore
  }
  reconcileLogger()?.info(
    `Entitlement mirror reconciled: ${live} live entitlement(s), ${softDeleted} soft-deleted`,
  )
  return live
}
