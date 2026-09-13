import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container, ListenerStore } from '@sapphire/framework'
import { silentLogger } from '@thesharks/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { EntitlementBootListener } from '../src/listeners/premium/entitlementBoot.mjs'
import { OperatorCommandsPlacementListener } from '../src/listeners/registration/operatorCommands.mjs'

const create = vi.fn(async () => undefined)
const shards = new Map<number, unknown>()
beforeEach(() => {
  create.mockClear()
  shards.clear()
  shards.set(0, {})
  container.client = Object.assign(new EventEmitter(), {
    ws: { shards },
  }) as never
  container.logger = silentLogger
  container.tasks = { create } as never
  container.app = {
    config: { premiumSkus: new Map([[1n, 'premium']]) },
  } as never
})

it.each([EntitlementBootListener, OperatorCommandsPlacementListener])(
  '%s enqueues retryable boot work only on shard 0',
  async (Listener) => {
    const listener = new Listener(
      {
        name: 'boot',
        path: fileURLToPath(import.meta.url),
        root: dirname(fileURLToPath(import.meta.url)),
        store: new ListenerStore(),
      } as never,
      {},
    )
    await listener.run(container.client as never)
    expect(create).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        repeated: false,
        customJobOptions: expect.objectContaining({
          attempts: 30,
          backoff: { type: 'fixed', delay: 30_000 },
        }),
      }),
    )
    shards.clear()
    shards.set(1, {})
    await listener.run(container.client as never)
    expect(create).toHaveBeenCalledTimes(1)
  },
)
