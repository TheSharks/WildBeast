import { Identifiers, UserError } from '@sapphire/framework'
import type { ButtonBuilder } from 'discord.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@sapphire/plugin-i18next', async () => ({
  ...(await vi.importActual('@sapphire/plugin-i18next')),
  resolveKey: vi.fn(
    async (_interaction: unknown, key: string, values?: unknown) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  ),
}))

const { describeDenial, premiumDenialDetail } = await import(
  '../src/listeners/reporting/commandDenied.mjs'
)
const { FeaturePreconditionIdentifier } = await import(
  '../src/preconditions/Feature.mjs'
)
const { OwnerOnlyPreconditionIdentifier } = await import(
  '../src/preconditions/OwnerOnly.mjs'
)
const { PremiumPreconditionIdentifier } = await import(
  '../src/preconditions/Premium.mjs'
)

const app = {
  config: {
    premiumCatalog: new Map([['123', { tier: 'premium', scope: 'guild' }]]),
  },
} as never
const inGuild = { guildId: '500' } as never
const inDm = { guildId: null } as never

function denial(identifier: string, context: object = {}, message = 'denied') {
  return new UserError({ identifier, message, context })
}

describe('describeDenial', () => {
  it('turns a cooldown into a localized relative timestamp', async () => {
    const reply = await describeDenial(
      app,
      inGuild,
      denial(Identifiers.PreconditionCooldown, { remaining: 5_000 }),
    )
    expect(reply.content).toMatch(/^system\/errors:cooldown .*<t:\d+:R>/)
    expect(reply.components).toBeUndefined()
  })

  it('localizes feature and owner-only denials', async () => {
    expect(
      await describeDenial(app, inGuild, denial(FeaturePreconditionIdentifier)),
    ).toEqual({ content: 'system/errors:feature_unavailable' })
    expect(
      await describeDenial(
        app,
        inGuild,
        denial(OwnerOnlyPreconditionIdentifier),
      ),
    ).toEqual({ content: 'system/errors:owner_only' })
  })

  it('explains a premium denial and offers the matching SKU', async () => {
    const reply = await describeDenial(
      app,
      inGuild,
      denial(PremiumPreconditionIdentifier, {
        requiredTier: 'premium',
        requiredScope: 'guild',
      }),
    )
    expect(reply.content).toContain('system/errors:premium_required')
    expect(reply.content).toContain('This server needs premium')
    const button = reply.components?.[0]?.components[0] as ButtonBuilder
    expect((button.toJSON() as { sku_id?: string }).sku_id).toBe('123')
  })

  it('offers no guild SKU in DMs', async () => {
    const reply = await describeDenial(
      app,
      inDm,
      denial(PremiumPreconditionIdentifier, {
        requiredTier: 'premium',
        requiredScope: 'guild',
      }),
    )
    expect(reply.content).toMatch(/DM/)
    expect(reply.components).toBeUndefined()
  })

  it("passes another precondition's message through", async () => {
    expect(
      await describeDenial(
        app,
        inGuild,
        denial('preconditionNsfw', {}, 'This channel is not NSFW.'),
      ),
    ).toEqual({ content: 'This channel is not NSFW.' })
  })
})

describe('premiumDenialDetail (scope-aware denial copy)', () => {
  it('names the server for guild gates in guilds', () => {
    const copy = premiumDenialDetail({ guildId: '500' }, 'premium', 'guild')
    expect(copy).toMatch(/server/i)
    expect(copy).toContain('premium')
    expect(copy).toMatch(/guild/)
  })

  it('says guild gates cannot pass in DMs', () => {
    const copy = premiumDenialDetail({ guildId: null }, 'premium', 'guild')
    expect(copy).toMatch(/DM/)
    expect(copy).toContain('premium')
  })

  it('names the invoker for user gates', () => {
    const copy = premiumDenialDetail({ guildId: '500' }, 'premium', 'user')
    expect(copy).toMatch(/you need/i)
    expect(copy).toContain('premium')
    expect(copy).toMatch(/user/)
  })

  it('names both for any gates in guilds and only the user in DMs', () => {
    expect(premiumDenialDetail({ guildId: '500' }, 'premium', 'any')).toMatch(
      /you or this server/i,
    )
    expect(premiumDenialDetail({ guildId: null }, 'premium', 'any')).toMatch(
      /you need/i,
    )
  })
})
