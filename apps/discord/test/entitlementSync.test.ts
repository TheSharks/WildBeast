import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container, ListenerStore } from '@sapphire/framework'
import { silentLogger, snapshotEnv } from '@thesharks/test-utils'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('../src/premium/sync.mjs', async () => {
  const actual = await vi.importActual<
    typeof import('../src/premium/sync.mjs')
  >('../src/premium/sync.mjs')
  return {
    ...actual,
    upsertEntitlement: vi.fn(async () => undefined),
    reconcileEntitlements: vi.fn(async () => 0),
  }
})

const { reconcileEntitlements, upsertEntitlement } = vi.mocked(
  await import('../src/premium/sync.mjs'),
)
const {
  EntitlementCreateListener,
  EntitlementUpdateListener,
  EntitlementDeleteListener,
} = await import('../src/listeners/premium/entitlementSync.mjs')
const {
  BACKFILL_RESCHEDULE_DELAY_MS,
  BACKFILL_RETRY_DELAYS_MS,
  EntitlementBackfillListener,
} = await import('../src/listeners/premium/entitlementBackfill.mjs')

container.logger = silentLogger

const restoreEnv = snapshotEnv(['WILDBEAST_PREMIUM_SKUS'])
afterEach(() => {
  delete process.env.WILDBEAST_PREMIUM_SKUS
})
afterAll(restoreEnv)

function instantiate<T>(
  Ctor: new (context: never, options: object) => T,
  name: string,
): T {
  return new Ctor(
    {
      name,
      path: fileURLToPath(import.meta.url),
      root: dirname(fileURLToPath(import.meta.url)),
      store: new ListenerStore(),
    } as never,
    {},
  )
}

const gatewayEntitlement = {
  id: '900',
  skuId: '123',
  userId: '456',
  guildId: null,
  type: 8,
  deleted: false,
  startsAt: null,
  endsAt: null,
} as never

beforeEach(() => {
  upsertEntitlement.mockClear()
  upsertEntitlement.mockResolvedValue(undefined)
  reconcileEntitlements.mockClear()
  reconcileEntitlements.mockResolvedValue(0)
})

describe('entitlement sync listeners', () => {
  it('mirrors created entitlements', async () => {
    const listener = instantiate(
      EntitlementCreateListener,
      'entitlementCreateSync',
    )
    await listener.run(gatewayEntitlement)
    expect(upsertEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({ id: 900n, skuId: 123n, deleted: false }),
    )
  })

  it('mirrors the new state of updated entitlements', async () => {
    const listener = instantiate(
      EntitlementUpdateListener,
      'entitlementUpdateSync',
    )
    await listener.run(null as never, gatewayEntitlement)
    expect(upsertEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({ id: 900n, deleted: false }),
    )
  })

  it('forces the deleted flag on delete events', async () => {
    const listener = instantiate(
      EntitlementDeleteListener,
      'entitlementDeleteSync',
    )
    await listener.run(gatewayEntitlement)
    expect(upsertEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({ id: 900n, deleted: true }),
    )
  })

  it('logs mirror failures instead of throwing', async () => {
    upsertEntitlement.mockRejectedValueOnce(new Error('database is down'))
    const listener = instantiate(
      EntitlementCreateListener,
      'entitlementCreateSync',
    )
    await expect(listener.run(gatewayEntitlement)).resolves.toBeUndefined()
  })

  it('stores guild subscriptions as guild-only rows when both ids are set', async () => {
    const listener = instantiate(
      EntitlementCreateListener,
      'entitlementCreateSync',
    )
    await listener.run({
      ...gatewayEntitlement,
      userId: '456',
      guildId: '789',
    } as never)
    expect(upsertEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({ id: 900n, userId: null, guildId: 789n }),
    )
  })
})

describe('entitlement backfill', () => {
  const shardClient = (shards: number[] = [0]) =>
    ({ ws: { shards: new Set(shards) } }) as never

  it('retries a transient failure with backoff then succeeds', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    reconcileEntitlements
      .mockRejectedValueOnce(new Error('api is down'))
      .mockResolvedValueOnce(3)
    const listener = instantiate(
      EntitlementBackfillListener,
      'entitlementBackfill',
    )
    const sleep = vi.fn(async () => undefined)

    await listener.run(shardClient(), { sleep })

    expect(reconcileEntitlements).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledOnce()
    expect(sleep).toHaveBeenCalledWith(BACKFILL_RETRY_DELAYS_MS[0])
  })

  it('reschedules after exhausting attempts without throwing', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    reconcileEntitlements.mockRejectedValue(new Error('still down'))
    const listener = instantiate(
      EntitlementBackfillListener,
      'entitlementBackfill',
    )
    const sleep = vi.fn(async () => undefined)
    const schedule = vi.fn((_ms: number, _task: () => void) => undefined)

    await expect(
      listener.run(shardClient(), { sleep, schedule }),
    ).resolves.toBeUndefined()
    expect(reconcileEntitlements).toHaveBeenCalledTimes(
      1 + BACKFILL_RETRY_DELAYS_MS.length,
    )
    expect(sleep).toHaveBeenCalledTimes(BACKFILL_RETRY_DELAYS_MS.length)
    expect(schedule).toHaveBeenCalledOnce()
    expect(schedule).toHaveBeenCalledWith(
      BACKFILL_RESCHEDULE_DELAY_MS,
      expect.any(Function),
    )
  })

  it('retries beyond the immediate attempts when the reschedule fires', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    reconcileEntitlements.mockRejectedValue(new Error('still down'))
    const listener = instantiate(
      EntitlementBackfillListener,
      'entitlementBackfill',
    )
    const sleep = vi.fn(async () => undefined)
    const tasks: Array<() => void> = []
    const schedule = vi.fn((_ms: number, task: () => void) => {
      tasks.push(task)
    })

    await listener.run(shardClient(), { sleep, schedule })
    expect(schedule).toHaveBeenCalledOnce()

    // Firing the rescheduled rerun attempts the reconcile again past attempt 3.
    tasks[0]!()
    await vi.waitFor(() => {
      expect(schedule).toHaveBeenCalledTimes(2)
    })
    expect(reconcileEntitlements.mock.calls.length).toBeGreaterThan(
      1 + BACKFILL_RETRY_DELAYS_MS.length,
    )
  })

  it('keeps the shard-0 gate: other shards never reconcile', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const listener = instantiate(
      EntitlementBackfillListener,
      'entitlementBackfill',
    )
    await listener.run(shardClient([1, 2]), { sleep: vi.fn() })
    expect(reconcileEntitlements).not.toHaveBeenCalled()
  })

  it('skips without SKUs and re-triggers once they appear', async () => {
    const listener = instantiate(
      EntitlementBackfillListener,
      'entitlementBackfill',
    )
    await listener.run(shardClient(), { sleep: vi.fn() })
    expect(reconcileEntitlements).not.toHaveBeenCalled()

    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    await listener.run(shardClient(), { sleep: vi.fn() })
    expect(reconcileEntitlements).toHaveBeenCalledOnce()
  })
})
