import { InMemoryProvider } from '@openfeature/server-sdk'
import { silentLogger } from '@thesharks/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { Experiments } from '../src/features/experiments.mjs'
import { FeatureFlags } from '../src/features/flags.mjs'

const gateProvider = (contextEvaluator: (context: never) => string) =>
  new InMemoryProvider({
    'features.commands.booru': {
      disabled: false,
      variants: { enabled: true, disabled: false },
      defaultVariant: 'disabled',
      contextEvaluator: contextEvaluator as never,
    },
    'experiments.tags.notFoundReply': {
      disabled: false,
      variants: { plain: 'plain', suggestion: 'suggestion', bogus: 'bogus' },
      defaultVariant: 'plain',
      contextEvaluator: contextEvaluator as never,
    },
  })

async function open(
  contextEvaluator: (context: never) => string,
  options: { cacheTtlMs?: number; now?: () => number } = {},
) {
  const flags = new FeatureFlags({
    provider: gateProvider(contextEvaluator),
    logger: silentLogger,
    cacheTtlMs: options.cacheTtlMs ?? 30_000,
    ...(options.now ? { now: options.now } : {}),
    baseContext: { environment: 'test' },
  })
  await flags.open()
  return flags
}

describe('replacement feature flags', () => {
  it('serves registry defaults without a provider and never opens one', async () => {
    const flags = new FeatureFlags()
    await flags.open()
    expect(flags.isActive).toBe(false)
    await expect(
      flags.enabled('features.commands.booru', { targetingKey: '1' }),
    ).resolves.toBe(true)
    await expect(
      flags.limit('limits.tags.maxPerGuild', 7, { targetingKey: '1' }),
    ).resolves.toBe(7)
  })

  it('reuses one provider resolution per flag and context within the TTL', async () => {
    const evaluator = vi.fn(() => 'enabled')
    const flags = await open(evaluator)
    const context = { targetingKey: 'guild:1', guildId: '1' }
    await expect(
      flags.enabled('features.commands.booru', context),
    ).resolves.toBe(true)
    await expect(
      flags.enabled('features.commands.booru', context),
    ).resolves.toBe(true)
    expect(evaluator).toHaveBeenCalledTimes(1)
    await flags.enabled('features.commands.booru', { targetingKey: 'guild:2' })
    expect(evaluator).toHaveBeenCalledTimes(2)
    await flags.close()
    expect(flags.isActive).toBe(false)
  })

  it('evaluates every time when the cache TTL is zero and attaches the base context', async () => {
    const evaluator = vi.fn((context: { environment?: string }) =>
      context.environment === 'test' ? 'enabled' : 'disabled',
    )
    const flags = await open(evaluator as never, { cacheTtlMs: 0 })
    const context = { targetingKey: 'guild:1' }
    await expect(
      flags.enabled('features.commands.booru', context),
    ).resolves.toBe(true)
    await expect(
      flags.enabled('features.commands.booru', context),
    ).resolves.toBe(true)
    expect(evaluator).toHaveBeenCalledTimes(2)
    await flags.close()
  })

  it('stops calling the provider after repeated outages and evicts failed lookups', async () => {
    const evaluator = vi.fn((): string => {
      throw new Error('flag service is down')
    })
    const flags = await open(evaluator)
    for (const guild of ['1', '2', '3', '4']) {
      await expect(
        flags.enabled('features.commands.booru', { targetingKey: guild }),
      ).resolves.toBe(true)
    }
    expect(evaluator).toHaveBeenCalledTimes(3)
    await flags.close()
  })

  it('serves the last good value during cooldown when no fresh cache exists', async () => {
    let now = 0
    const evaluator = vi.fn((context: { guildId?: string }) => {
      if (context.guildId === 'kill-switched') return 'disabled'
      throw new Error('flag service is down')
    })
    const flags = await open(evaluator as never, {
      cacheTtlMs: 0,
      now: () => now,
    })
    const killed = { targetingKey: 'kill-switched', guildId: 'kill-switched' }
    await expect(
      flags.enabled('features.commands.booru', killed),
    ).resolves.toBe(false)
    for (const guildId of ['2', '3', '4'])
      await flags.enabled('features.commands.booru', {
        targetingKey: guildId,
        guildId,
      })
    await expect(
      flags.enabled('features.commands.booru', killed),
    ).resolves.toBe(false)
    expect(evaluator).toHaveBeenCalledTimes(4)
    now = 31_000
    await flags.enabled('features.commands.booru', killed)
    expect(evaluator).toHaveBeenCalledTimes(5)
    await flags.close()
  })
})

describe('replacement experiments', () => {
  it('assigns once per operation, rejects unknown variants and attributes outcomes', async () => {
    const evaluator = vi.fn(() => 'bogus')
    const flags = await open(evaluator, { cacheTtlMs: 0 })
    const experiments = new Experiments(flags)
    const context = { targetingKey: 'guild:1' }
    const result = await experiments.run(
      { kind: 'command', name: 'tag.show' },
      async () => {
        const first = await experiments.variant(
          'experiments.tags.notFoundReply',
          context,
        )
        const second = await experiments.variant(
          'experiments.tags.notFoundReply',
          context,
        )
        return [first, second]
      },
    )
    expect(result).toEqual(['suggestion', 'suggestion'])
    expect(evaluator).toHaveBeenCalledTimes(1)
    await flags.close()
  })
})
