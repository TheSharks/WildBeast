import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container, PreconditionStore } from '@sapphire/framework'
import { silentLogger } from '@thesharks/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { FeatureFlags } from '../src/features/flags.mjs'
import { CommandGates, denialReason } from '../src/features/gates.mjs'
import {
  FeaturePrecondition,
  FeaturePreconditionIdentifier,
} from '../src/preconditions/Feature.mjs'
import {
  PremiumPrecondition,
  PremiumPreconditionIdentifier,
} from '../src/preconditions/Premium.mjs'
import type { EntitlementRepository } from '../src/premium/model.mjs'
import { PremiumService } from '../src/premium/service.mjs'

const repository: EntitlementRepository = {
  state: vi.fn(),
  forOwner: vi.fn(),
  write: vi.fn(),
  replace: vi.fn(),
}

function services(enabled = true) {
  const flags = new FeatureFlags()
  vi.spyOn(flags, 'enabled').mockResolvedValue(enabled)
  const premium = new PremiumService(repository, new Map([[123n, 'premium']]))
  const gates = new CommandGates(flags, premium)
  return { flags, premium, gates }
}

interface FakeEntitlement {
  skuId: string
  guildId?: string
  deleted?: boolean
}

function interaction(
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
          id: String(index + 1),
          skuId: entitlement.skuId,
          userId: '900',
          guildId: entitlement.guildId ?? null,
          type: 8,
          deleted: entitlement.deleted ?? false,
          startsAt: null,
          endsAt: null,
        },
      ]),
    ),
    isChatInputCommand: () => true,
    isAutocomplete: () => false,
    options: { getSubcommand: () => null },
  } as never
}

describe('shared command gates', () => {
  it('keeps user subscriptions out of guild enforcement while targeting sees the best tier', async () => {
    const { gates } = services()
    gates.requirePremium('booru', { scope: 'guild' })
    const evaluation = await gates.evaluateInteraction(
      interaction([{ skuId: '123' }]),
      'booru',
    )
    expect(evaluation).toMatchObject({
      tierAny: 'premium',
      tierEnforced: 'free',
      premiumAllowed: false,
      flagEnabled: true,
      flagKey: 'features.commands.booru',
    })
    expect(denialReason(evaluation)).toBe('premium')
  })

  it('reports feature denials before premium denials and allows unregistered commands', async () => {
    const { gates } = services(false)
    gates.requirePremium('booru')
    const denied = await gates.evaluateInteraction(interaction([]), 'booru')
    expect(denialReason(denied)).toBe('feature')
    const open = await gates.evaluateInteraction(interaction([]), 'ping')
    expect(open.premiumAllowed).toBe(true)
    expect(open.flagKey).toBe('features.commands.ping')
  })

  it('answers the synchronous premium slice for components and autocomplete', () => {
    const { gates } = services()
    gates.requirePremium('booru', { scope: 'guild' })
    const subject = (
      guildId: string | null,
      entitlements: FakeEntitlement[],
    ) => ({
      userId: 900n,
      guildId: guildId === null ? null : BigInt(guildId),
      grants: [...interaction(entitlements, guildId).entitlements.values()].map(
        (raw: never) => ({
          ...(raw as object),
          id: 1n,
          skuId: 123n,
          owner: (raw as { guildId: string | null }).guildId
            ? {
                scope: 'guild' as const,
                id: BigInt((raw as { guildId: string }).guildId),
              }
            : { scope: 'user' as const, id: 900n },
        }),
      ),
    })
    expect(
      gates.premiumAllowed(
        subject('500', [{ skuId: '123', guildId: '500' }]) as never,
        'booru',
      ),
    ).toBe(true)
    expect(
      gates.premiumAllowed(
        subject('500', [{ skuId: '123' }]) as never,
        'booru',
      ),
    ).toBe(false)
    expect(
      gates.premiumAllowed(
        subject(null, [{ skuId: '123', guildId: '500' }]) as never,
        'booru',
      ),
    ).toBe(false)
    expect(gates.premiumAllowed(subject('500', []) as never, 'ping')).toBe(true)
  })
})

describe('replacement preconditions', () => {
  const context = {
    name: 'fixture',
    path: fileURLToPath(import.meta.url),
    root: dirname(fileURLToPath(import.meta.url)),
    store: new PreconditionStore(),
  } as never

  it('denies with the feature identifier when the gate is off', async () => {
    container.logger = silentLogger
    container.app = { ...services(false) } as never
    const precondition = new FeaturePrecondition(context, {})
    const result = await precondition.chatInputRun(
      interaction([]),
      { name: 'booru' } as never,
      { key: 'features.commands.booru' } as never,
    )
    expect(result.unwrapErr().identifier).toBe(FeaturePreconditionIdentifier)
    container.app = { ...services(true) } as never
    expect(
      (
        await precondition.chatInputRun(
          interaction([]),
          { name: 'booru' } as never,
          { key: 'features.commands.booru' } as never,
        )
      ).isOk(),
    ).toBe(true)
  })

  it('enforces tier and scope from interaction grants only', async () => {
    container.logger = silentLogger
    container.app = { ...services() } as never
    const precondition = new PremiumPrecondition(context, {})
    const guildGate = { scope: 'guild' } as never
    expect(
      (
        await precondition.chatInputRun(
          interaction([{ skuId: '123', guildId: '500' }]),
          undefined as never,
          guildGate,
        )
      ).isOk(),
    ).toBe(true)
    const denied = await precondition.chatInputRun(
      interaction([{ skuId: '123' }]),
      undefined as never,
      guildGate,
    )
    expect(denied.unwrapErr()).toMatchObject({
      identifier: PremiumPreconditionIdentifier,
      context: {
        requiredTier: 'premium',
        requiredScope: 'guild',
        currentTier: 'free',
      },
    })
    expect(
      (
        await precondition.contextMenuRun(
          interaction([{ skuId: '123', guildId: '500' }], null),
          undefined as never,
          guildGate,
        )
      ).isErr(),
    ).toBe(true)
    expect(
      (
        await precondition.chatInputRun(
          interaction([{ skuId: '123', deleted: true }]),
          undefined as never,
          {} as never,
        )
      ).isErr(),
    ).toBe(true)
    expect(repository.forOwner).not.toHaveBeenCalled()
  })
})
