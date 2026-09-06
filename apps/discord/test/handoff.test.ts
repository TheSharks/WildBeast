import type { Client, SessionInfo } from 'discord.js'
import { expect, it, vi } from 'vitest'
import { stopGatewayForHandoff } from '../src/sharding/handoff.mjs'

it('keeps the final session while closing without reconnecting', async () => {
  const update = vi.fn()
  const session = { sequence: 42 } as SessionInfo
  const manager = {
    options: { updateSessionInfo: update },
    destroy: vi.fn(async () => {
      manager.options.updateSessionInfo(0, session)
      manager.options.updateSessionInfo(0, null)
    }),
  }
  const client = { ws: { _ws: manager, destroyed: false } }
  await stopGatewayForHandoff(client as unknown as Client)
  expect(manager.destroy).toHaveBeenCalledWith({
    code: 4200,
    reason: 'Shard ownership handoff',
  })
  expect(update).toHaveBeenCalledExactlyOnceWith(0, session)
  expect(manager.options.updateSessionInfo).toBe(update)
  expect(client.ws.destroyed).toBe(true)
})

it('restores session invalidation if teardown fails', async () => {
  const update = vi.fn()
  const manager = {
    options: { updateSessionInfo: update },
    destroy: vi.fn().mockRejectedValue(new Error('close failed')),
  }
  await expect(
    stopGatewayForHandoff({ ws: { _ws: manager } } as unknown as Client),
  ).rejects.toThrow('close failed')
  expect(manager.options.updateSessionInfo).toBe(update)
})
