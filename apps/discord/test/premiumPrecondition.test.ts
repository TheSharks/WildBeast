import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container, PreconditionStore } from '@sapphire/framework'
import { silentLogger, snapshotEnv } from '@thesharks/test-utils'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import {
  isPremiumSatisfied,
  PremiumPrecondition,
  type PremiumPreconditionContext,
  PremiumPreconditionIdentifier,
  premiumAutocompleteAllowed,
  premiumComponentAllowed,
  requirePremium,
} from '../src/preconditions/Premium.mjs'

const restoreEnv = snapshotEnv(['WILDBEAST_PREMIUM_SKUS'])
afterEach(() => {
  delete process.env.WILDBEAST_PREMIUM_SKUS
})
afterAll(restoreEnv)

container.logger = silentLogger

const precondition = new PremiumPrecondition(
  {
    name: 'Premium',
    path: fileURLToPath(import.meta.url),
    root: dirname(fileURLToPath(import.meta.url)),
    store: new PreconditionStore(),
  } as never,
  {},
)

interface FakeEntitlement {
  skuId: string
  active?: boolean
  guildId?: string
}

function fakeInteraction(
  entitlements: FakeEntitlement[],
  guildId: string | null = '500',
) {
  return {
    guildId,
    guild: null,
    user: { id: '900' },
    entitlements: new Map(
      entitlements.map((entitlement, index) => [
        String(index),
        {
          skuId: entitlement.skuId,
          guildId: entitlement.guildId ?? null,
          isActive: () => entitlement.active ?? true,
        },
      ]),
    ),
  } as never
}

function check(
  entitlements: FakeEntitlement[],
  context: PremiumPreconditionContext = {},
  guildId: string | null = '500',
) {
  return precondition.chatInputRun(
    fakeInteraction(entitlements, guildId),
    undefined as never,
    context as never,
  )
}

describe('PremiumPrecondition', () => {
  it('denies everyone when no SKUs are configured', async () => {
    const result = await check([{ skuId: '123' }])
    expect(result.isErr()).toBe(true)
  })

  it('passes any active subscription with the default any scope', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    expect((await check([{ skuId: '123' }])).isOk()).toBe(true)
    expect((await check([{ skuId: '123', guildId: '500' }])).isOk()).toBe(true)
    expect((await check([])).isErr()).toBe(true)
  })

  it('only counts guild subscriptions for scope guild', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const context = { scope: 'guild' } as const
    expect(
      (await check([{ skuId: '123', guildId: '500' }], context)).isOk(),
    ).toBe(true)
    // A user subscription doesn't satisfy a guild gate.
    expect((await check([{ skuId: '123' }], context)).isErr()).toBe(true)
  })

  it('only counts the invoker’s own subscription for scope user', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const context = { scope: 'user' } as const
    expect((await check([{ skuId: '123' }], context)).isOk()).toBe(true)
    expect(
      (await check([{ skuId: '123', guildId: '500' }], context)).isErr(),
    ).toBe(true)
  })

  it('always denies guild-scoped gates in DMs', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const result = await check(
      [{ skuId: '123', guildId: '500' }],
      { scope: 'guild' },
      null,
    )
    expect(result.isErr()).toBe(true)
  })

  it('ignores inactive entitlements', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    expect((await check([{ skuId: '123', active: false }])).isErr()).toBe(true)
  })

  it('carries the reply-building context on denial', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const result = await check([], { scope: 'guild' })
    const error = result.unwrapErr()
    expect(error.identifier).toBe(PremiumPreconditionIdentifier)
    expect(error.context).toMatchObject({
      requiredTier: 'premium',
      requiredScope: 'guild',
      currentTier: 'free',
    })
  })

  it('mirrors the check for context menu commands', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const result = await precondition.contextMenuRun(
      fakeInteraction([{ skuId: '123' }]),
      undefined as never,
      {} as never,
    )
    expect(result.isOk()).toBe(true)
  })
})

describe('requirePremium helpers (autocomplete + component re-checks)', () => {
  it('exposes the same gate synchronously for non-command surfaces', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const authed = fakeInteraction([{ skuId: '123', guildId: '500' }])
    const anon = fakeInteraction([])
    const guildGate = { scope: 'guild' } as const

    expect(isPremiumSatisfied(authed, guildGate)).toBe(true)
    expect(isPremiumSatisfied(anon, guildGate)).toBe(false)
    expect(requirePremium(authed, guildGate)).toBe(true)
    expect(premiumAutocompleteAllowed(authed, guildGate)).toBe(true)
    expect(premiumAutocompleteAllowed(anon, guildGate)).toBe(false)
    expect(premiumComponentAllowed(authed, guildGate)).toBe(true)
    expect(premiumComponentAllowed(anon, guildGate)).toBe(false)
  })

  it('denies guild gates in DMs on every surface', () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const dm = fakeInteraction([{ skuId: '123', guildId: '500' }], null)
    const guildGate = { scope: 'guild' } as const
    expect(isPremiumSatisfied(dm, guildGate)).toBe(false)
    expect(premiumAutocompleteAllowed(dm, guildGate)).toBe(false)
    expect(premiumComponentAllowed(dm, guildGate)).toBe(false)
  })

  it('wires autocomplete suppression and component checks through gates.mts', async () => {
    process.env.WILDBEAST_PREMIUM_SKUS = '123:premium'
    const { commandPremiumAllowed, installCommandPremiumGate, premiumGateFor } =
      await import('../src/features/gates.mjs')

    const append = vi.fn()
    const autocompleteRun = vi.fn(async () => 'ran')
    const command = {
      name: 'premium-fixture-command',
      preconditions: { append },
      autocompleteRun,
    }
    installCommandPremiumGate(command as never, { scope: 'guild' })

    expect(append).toHaveBeenCalledWith({
      name: 'Premium',
      context: { scope: 'guild' },
    })
    expect(premiumGateFor('premium-fixture-command')).toEqual({
      scope: 'guild',
    })

    // Autocomplete from a subscriber runs; from anyone else responds empty.
    const respond = vi.fn(async () => undefined)
    await (command as never as { autocompleteRun: Function }).autocompleteRun({
      ...fakeInteraction([{ skuId: '123', guildId: '500' }]),
      respond,
    } as never)
    expect(autocompleteRun).toHaveBeenCalledOnce()
    autocompleteRun.mockClear()
    await (command as never as { autocompleteRun: Function }).autocompleteRun({
      ...fakeInteraction([]),
      respond,
    } as never)
    expect(autocompleteRun).not.toHaveBeenCalled()
    expect(respond).toHaveBeenCalledWith([])

    // Component re-checks follow the same gate; unknown commands pass.
    expect(
      commandPremiumAllowed(
        fakeInteraction([{ skuId: '123', guildId: '500' }]),
        'premium-fixture-command',
      ),
    ).toBe(true)
    expect(
      commandPremiumAllowed(fakeInteraction([]), 'premium-fixture-command'),
    ).toBe(false)
    expect(commandPremiumAllowed(fakeInteraction([]), 'unregistered')).toBe(
      true,
    )
  })
})
