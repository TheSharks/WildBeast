import {
  createDatabase,
  entitlementMirrorState,
  entitlements,
  sql,
} from '@thesharks/drizzle'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PostgresEntitlements } from '../src/adapters/entitlements-postgres.mjs'
import type { Grant } from '../src/premium/model.mjs'
import {
  EntitlementSynchronizer,
  PremiumService,
} from '../src/premium/service.mjs'

// These tests replace the entire mirror; DATABASE_URL must be a disposable
// database with every migration applied.
const url = process.env.DATABASE_URL

describe.skipIf(!url)('replacement premium PostgreSQL contracts', () => {
  let connection: ReturnType<typeof createDatabase>
  let repository: PostgresEntitlements
  const grant: Grant = {
    id: 1n,
    skuId: 10n,
    owner: { scope: 'guild', id: 20n },
    type: 8,
    deleted: false,
    startsAt: null,
    endsAt: null,
  }

  beforeAll(() => {
    connection = createDatabase(url!)
    repository = new PostgresEntitlements(connection.db)
  })
  beforeEach(async () => {
    await connection.db.delete(entitlements)
    await connection.db
      .update(entitlementMirrorState)
      .set({ completedAt: null })
  })
  afterAll(async () => {
    await connection?.close()
  })

  it('records a fresh empty full snapshot, without relying on MAX(row timestamp)', async () => {
    const state = await repository.state()
    expect(await repository.replace(state.revision, [])).toBe(true)
    const service = new PremiumService(repository, new Map([[10n, 'premium']]))
    await expect(service.forBackground('guild', 20n)).resolves.toEqual({
      tier: 'free',
      freshness: 'fresh',
      mayRevoke: true,
      validUntil: expect.any(Number),
    })
  })

  it('detects writes made through the original runtime as well as the new adapter', async () => {
    const before = await repository.state()
    await connection.db.insert(entitlements).values({
      id: 1n,
      skuId: 10n,
      guildId: 20n,
      type: 8,
    })
    expect(await repository.replace(before.revision, [])).toBe(false)
    const view = await repository.forOwner('guild', 20n)
    expect(view.grants).toHaveLength(1)
    expect(view.state.completedAt).toBeNull()
    expect(view.state.revision).toBeGreaterThan(before.revision)
  })

  it('does not publish freshness or revoke a grant received during fetch', async () => {
    const sync = new EntitlementSynchronizer(repository, {
      fetchAll: async () => {
        await repository.write(grant)
        return []
      },
    })
    await expect(
      sync.synchronize(new AbortController().signal),
    ).resolves.toEqual({ kind: 'superseded' })
    const view = await repository.forOwner('guild', 20n)
    expect(view.grants[0]?.deleted).toBe(false)
    expect(view.state.completedAt).toBeNull()
  })

  it('only one competing full snapshot can commit the same revision', async () => {
    const { revision } = await repository.state()
    const results = await Promise.all([
      repository.replace(revision, [grant]),
      repository.replace(revision, []),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('gateway updates cannot make an old full snapshot fresh', async () => {
    const old = new Date('2000-01-01T00:00:00Z')
    await connection.db.update(entitlementMirrorState).set({ completedAt: old })
    await repository.write(grant)
    const service = new PremiumService(repository, new Map([[10n, 'premium']]))
    await expect(service.forBackground('guild', 20n)).resolves.toEqual({
      tier: 'premium',
      freshness: 'stale',
      mayRevoke: false,
      validUntil: null,
    })
  })

  it('rolls back grants and revision when a snapshot write fails', async () => {
    const before = await repository.state()
    // Out-of-range snowflake is rejected by PostgreSQL after the first insert.
    await expect(
      repository.replace(before.revision, [grant, { ...grant, id: 2n ** 70n }]),
    ).rejects.toThrow()
    expect(await repository.state()).toEqual(before)
    expect((await repository.forOwner('guild', 20n)).grants).toEqual([])
  })

  it('legacy-row migrations and state trigger coexist', async () => {
    const state = await repository.state()
    await connection.db.execute(
      sql`UPDATE "Entitlement" SET "updatedAt" = now()`,
    )
    expect((await repository.state()).revision).toBeGreaterThan(state.revision)
  })
})
