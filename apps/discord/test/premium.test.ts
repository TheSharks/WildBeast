import { describe, expect, it, vi } from 'vitest'
import {
  type EntitlementRepository,
  type Grant,
  normalizeGrant,
  tierFor,
} from '../src/premium/model.mjs'
import {
  EntitlementSynchronizer,
  PremiumService,
} from '../src/premium/service.mjs'

const now = Date.parse('2026-09-05T00:00:00Z')
const grant: Grant = {
  id: 1n,
  skuId: 10n,
  owner: { scope: 'guild', id: 20n },
  type: 8,
  deleted: false,
  startsAt: null,
  endsAt: null,
}
const skus = new Map([[10n, 'premium' as const]])

function repository(completedAt: Date | null = new Date(now)) {
  const view = { grants: [] as Grant[], state: { revision: 0n, completedAt } }
  return {
    view,
    state: vi.fn(async () => ({ ...view.state })),
    forOwner: vi.fn(async () => view),
    write: vi.fn(async (value: Grant) => {
      view.grants = [value]
      view.state.revision++
    }),
    replace: vi.fn(async (revision: bigint, grants: readonly Grant[]) => {
      if (view.state.revision !== revision) return false
      view.grants = [...grants]
      view.state = { revision: revision + 1n, completedAt: new Date(now) }
      return true
    }),
  } satisfies EntitlementRepository & { view: unknown }
}

describe('replacement premium policy', () => {
  it('keeps guild benefits separate from user benefits', () => {
    expect(tierFor([grant], 'guild', 20n, skus, now)).toBe('premium')
    expect(tierFor([grant], 'user', 20n, skus, now)).toBe('free')
    expect(tierFor([grant], 'guild', 21n, skus, now)).toBe('free')
  })

  it.each([
    { deleted: true },
    { startsAt: new Date(now + 1) },
    { endsAt: new Date(now) },
    { endsAt: new Date(Number.NaN) },
  ])('does not grant an inactive entitlement: %o', (override) => {
    expect(tierFor([{ ...grant, ...override }], 'guild', 20n, skus, now)).toBe(
      'free',
    )
  })

  it('normalizes the guild purchaser and rejects ownerless records', () => {
    const raw = { ...grant, id: '1', skuId: '10', guildId: '20', userId: '30' }
    expect(normalizeGrant(raw).owner).toEqual({ scope: 'guild', id: 20n })
    expect(() =>
      normalizeGrant({ ...raw, guildId: null, userId: null }),
    ).toThrow('no owner')
  })

  it.each([
    [null, 'never-synced'],
    [new Date(now - 86400001), 'stale'],
    [new Date(now + 1), 'invalid-clock'],
    [new Date(Number.NaN), 'invalid-clock'],
  ] as const)('defers revocations when completedAt is %s', async (date, freshness) => {
    const repo = repository(date)
    repo.view.grants = [{ ...grant, deleted: true }]
    const service = new PremiumService(repo, skus, () => now)
    await expect(service.forBackground('guild', 20n)).resolves.toEqual({
      tier: 'free',
      freshness,
      mayRevoke: false,
      validUntil: null,
    })
  })

  it('treats a completed empty snapshot as fresh', async () => {
    const service = new PremiumService(repository(), skus, () => now)
    await expect(service.forBackground('guild', 20n)).resolves.toEqual({
      tier: 'free',
      freshness: 'fresh',
      mayRevoke: true,
      validUntil: now + 86400000,
    })
  })

  it('uses interaction grants without querying the mirror', () => {
    const repo = repository(null)
    const service = new PremiumService(repo, skus, () => now)
    expect(service.forInteraction([grant], 'guild', 20n)).toBe('premium')
    expect(repo.forOwner).not.toHaveBeenCalled()
  })
})

describe('replacement entitlement synchronization', () => {
  it('does not overwrite a gateway update received during fetch', async () => {
    const repo = repository(null)
    const source = {
      fetchAll: vi.fn(async () => {
        await repo.write(grant)
        return []
      }),
    }
    const sync = new EntitlementSynchronizer(repo, source)
    await expect(
      sync.synchronize(new AbortController().signal),
    ).resolves.toEqual({ kind: 'superseded' })
    expect(repo.view.grants).toEqual([grant])
    expect(repo.view.state.completedAt).toBeNull()
  })

  it('coalesces simultaneous sync requests and permits a subsequent sync', async () => {
    const repo = repository(null)
    const source = { fetchAll: vi.fn(async () => [grant]) }
    const sync = new EntitlementSynchronizer(repo, source)
    const signal = new AbortController().signal
    const first = sync.synchronize(signal)
    expect(sync.synchronize(signal)).toBe(first)
    await expect(first).resolves.toEqual({ kind: 'completed', count: 1 })
    await sync.synchronize(signal)
    expect(source.fetchAll).toHaveBeenCalledTimes(2)
  })

  it('does not publish freshness when fetching fails', async () => {
    const repo = repository(null)
    const sync = new EntitlementSynchronizer(repo, {
      fetchAll: async () => {
        throw new Error('page failed')
      },
    })
    await expect(
      sync.synchronize(new AbortController().signal),
    ).rejects.toThrow('page failed')
    expect(repo.replace).not.toHaveBeenCalled()
  })

  it('does not commit after shutdown aborts a fetch', async () => {
    const repo = repository(null)
    const controller = new AbortController()
    const sync = new EntitlementSynchronizer(repo, {
      fetchAll: async () => {
        controller.abort()
        return [grant]
      },
    })
    await expect(sync.synchronize(controller.signal)).rejects.toThrow()
    expect(repo.replace).not.toHaveBeenCalled()
  })
})
