import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container, ListenerStore } from '@sapphire/framework'
import { silentLogger } from '@thesharks/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/premium/sync.mjs', async () => {
  const actual = await vi.importActual<
    typeof import('../src/premium/sync.mjs')
  >('../src/premium/sync.mjs')
  return { ...actual, upsertEntitlement: vi.fn(async () => undefined) }
})

const { upsertEntitlement } = vi.mocked(await import('../src/premium/sync.mjs'))
const {
  EntitlementCreateListener,
  EntitlementUpdateListener,
  EntitlementDeleteListener,
} = await import('../src/listeners/premium/entitlementSync.mjs')

container.logger = silentLogger

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
})
