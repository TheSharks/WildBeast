import type { Client, FetchEntitlementsOptions } from 'discord.js'
import { expect, it, vi } from 'vitest'
import { DiscordEntitlements } from '../src/adapters/entitlements-discord.mjs'

function page(start: number, end: number) {
  return new Map(
    Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => {
      const id = String(start + index)
      return [
        id,
        {
          id,
          skuId: '10',
          guildId: '20',
          userId: '30',
          type: 8,
          deleted: false,
          startsAt: null,
          endsAt: null,
        },
      ]
    }),
  )
}

it('fetches and normalizes a complete bidirectional entitlement listing', async () => {
  const fetch = vi.fn(async (options: FetchEntitlementsOptions) => {
    if (options.before === '101') return page(1, 100)
    if (options.before === '1') return page(1, 0)
    if (options.after === '200') return page(201, 250)
    return page(101, 200)
  })
  const source = new DiscordEntitlements({
    application: { entitlements: { fetch } },
  } as unknown as Client<true>)
  const rows = await source.fetchAll(new AbortController().signal)
  expect(rows).toHaveLength(250)
  expect(new Set(rows.map((row) => row.id)).size).toBe(250)
  expect(
    rows.every((row) => row.owner.scope === 'guild' && row.owner.id === 20n),
  ).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(4)
  for (const [options] of fetch.mock.calls) {
    expect(options).toMatchObject({
      excludeDeleted: false,
      excludeEnded: false,
      cache: false,
    })
  }
})

it('rejects an invalid final short page instead of certifying a partial listing', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(page(101, 200))
    .mockResolvedValueOnce(page(100, 101))
  const source = new DiscordEntitlements({
    application: { entitlements: { fetch } },
  } as unknown as Client<true>)
  await expect(source.fetchAll(new AbortController().signal)).rejects.toThrow(
    'violated before cursor',
  )
})

it('stops between requests when shutdown interrupts pagination', async () => {
  const controller = new AbortController()
  const fetch = vi.fn(async () => {
    controller.abort()
    return page(101, 200)
  })
  const source = new DiscordEntitlements({
    application: { entitlements: { fetch } },
  } as unknown as Client<true>)
  await expect(source.fetchAll(controller.signal)).rejects.toThrow()
  expect(fetch).toHaveBeenCalledOnce()
})
