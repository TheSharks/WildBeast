import {
  and,
  entitlementMirrorState,
  entitlements,
  eq,
  type getDb,
  isNull,
  notInArray,
  sql,
} from '@thesharks/drizzle'
import type { EntitlementRepository, Grant, Scope } from '../premium/model.mjs'

type Database = ReturnType<typeof getDb>

function row(grant: Grant) {
  return {
    id: grant.id,
    skuId: grant.skuId,
    guildId: grant.owner.scope === 'guild' ? grant.owner.id : null,
    userId: grant.owner.scope === 'user' ? grant.owner.id : null,
    type: grant.type,
    deleted: grant.deleted,
    startsAt: grant.startsAt,
    endsAt: grant.endsAt,
    updatedAt: sql`now()`,
  }
}

export class PostgresEntitlements implements EntitlementRepository {
  private readonly database: () => Database

  /** Accepts a getter so the repository can exist before the pool opens. */
  public constructor(database: Database | (() => Database)) {
    this.database = typeof database === 'function' ? database : () => database
  }

  public async state() {
    const [state] = await this.database()
      .select()
      .from(entitlementMirrorState)
      .where(eq(entitlementMirrorState.id, 1))
    if (!state)
      throw new Error('Entitlement mirror state missing: run migrations')
    return state
  }

  public async forOwner(scope: Scope, id: bigint) {
    // A single MVCC snapshot makes the grants and freshness a consistent decision.
    return this.database().transaction(
      async (tx) => {
        const [state] = await tx
          .select()
          .from(entitlementMirrorState)
          .where(eq(entitlementMirrorState.id, 1))
        if (!state)
          throw new Error('Entitlement mirror state missing: run migrations')
        const rows = await tx
          .select()
          .from(entitlements)
          .where(
            scope === 'guild'
              ? eq(entitlements.guildId, id)
              : and(eq(entitlements.userId, id), isNull(entitlements.guildId)),
          )
        const grants: Grant[] = rows.map((record) => ({
          id: record.id,
          skuId: record.skuId,
          owner: { scope, id },
          type: record.type,
          deleted: record.deleted,
          startsAt: record.startsAt,
          endsAt: record.endsAt,
        }))
        return { state, grants }
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    )
  }

  public async write(grant: Grant): Promise<void> {
    await this.database().transaction(async (tx) => {
      // Same lock order as snapshot commits. The DB trigger advances revision,
      // including writes from the original app during migration to this runtime.
      await tx
        .select()
        .from(entitlementMirrorState)
        .where(eq(entitlementMirrorState.id, 1))
        .for('update')
      const values = row(grant)
      await tx
        .insert(entitlements)
        .values(values)
        .onConflictDoUpdate({ target: entitlements.id, set: values })
    })
  }

  public async replace(
    expectedRevision: bigint,
    grants: readonly Grant[],
  ): Promise<boolean> {
    return this.database().transaction(async (tx) => {
      const [state] = await tx
        .select()
        .from(entitlementMirrorState)
        .where(eq(entitlementMirrorState.id, 1))
        .for('update')
      if (!state)
        throw new Error('Entitlement mirror state missing: run migrations')
      if (state.revision !== expectedRevision) return false
      const ids: bigint[] = []
      for (const grant of grants) {
        const values = row(grant)
        ids.push(grant.id)
        await tx
          .insert(entitlements)
          .values(values)
          .onConflictDoUpdate({ target: entitlements.id, set: values })
      }
      await tx
        .update(entitlements)
        .set({ deleted: true, updatedAt: sql`now()` })
        .where(ids.length ? notInArray(entitlements.id, ids) : undefined)
      // Even zero rows certify a successful, complete upstream listing.
      await tx
        .update(entitlementMirrorState)
        .set({ completedAt: sql`clock_timestamp()` })
        .where(eq(entitlementMirrorState.id, 1))
      return true
    })
  }
}
