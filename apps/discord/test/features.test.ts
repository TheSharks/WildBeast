import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { InMemoryProvider } from '@openfeature/server-sdk'
import { container, PreconditionStore } from '@sapphire/framework'
import {
  type ScheduledTask,
  ScheduledTaskStore,
} from '@sapphire/plugin-scheduled-tasks'
import { silentLogger, snapshotEnv } from '@thesharks/test-utils'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  booleanFlagValue,
  closeFeatureFlags,
  featureFlagsActive,
  initFeatureFlags,
  providerFromEnv,
} from '../src/features/client.mjs'
import {
  commandComponentEnabled,
  installCommandFeatureGate,
} from '../src/features/gates.mjs'
import {
  commandGateKey,
  expiredFlagKeys,
  flagKeys,
  flagRegistry,
  getFlagDefinition,
  taskGateKey,
} from '../src/features/registry.mjs'
import {
  FeaturePrecondition,
  FeaturePreconditionIdentifier,
} from '../src/preconditions/Feature.mjs'
import { limitFor } from '../src/premium/entitlements.mjs'
import { getLimit } from '../src/premium/limits.mjs'
import { TracedScheduledTask } from '../src/structures/task.mjs'

const restoreEnv = snapshotEnv(['WILDBEAST_OFREP', 'WILDBEAST_PREMIUM'])
afterAll(async () => {
  await closeFeatureFlags()
  restoreEnv()
})

container.logger = silentLogger

const FREE_TAG_LIMIT = getLimit('tags.maxPerGuild', 'free')

/** No premium SKUs configured in these tests, so tiers are always free;
 * only the flag evaluation path varies. */
function fakeInteraction(guildId: string | null = '500') {
  return {
    guildId,
    user: { id: '900' },
    entitlements: new Map(),
    guild: guildId ? { shardId: 2 } : null,
    isChatInputCommand: () => true,
    options: { getSubcommand: () => null },
  } as never
}

describe('typed flag registry', () => {
  it('gives every flag lifecycle metadata and a type-safe default', () => {
    expect(flagKeys).not.toHaveLength(0)
    for (const key of flagKeys) {
      const definition = getFlagDefinition(key)
      expect(definition.description).not.toBe('')
      expect(definition.owner).not.toBe('')
      expect(definition.targets).not.toHaveLength(0)
      if (definition.kind === 'gate') {
        expect(typeof definition.defaultValue).toBe('boolean')
      } else {
        expect(definition.variants).toContain(definition.defaultValue)
      }
    }
  })

  it('maps every current command and task name to its registered gate', () => {
    expect(commandGateKey('booru')).toBe('features.commands.booru')
    expect(taskGateKey('metricsCollection')).toBe(
      'features.tasks.metricsCollection',
    )
    expect(commandGateKey('not-a-command')).toBeUndefined()
    expect(taskGateKey('not-a-task')).toBeUndefined()
  })

  it('reports temporary flags after their expiry date', () => {
    expect(expiredFlagKeys(new Date('2026-07-10T00:00:00Z'))).toEqual([])
    expect(expiredFlagKeys(new Date('2027-02-01T00:00:00Z'))).toContain(
      'experiments.tags.notFoundReply',
    )
  })

  it('keeps every operational gate default-on', () => {
    for (const definition of Object.values(flagRegistry)) {
      if (definition.kind === 'gate') {
        expect(definition.defaultValue).toBe(true)
      }
    }
  })
})

describe('providerFromEnv', () => {
  it('is undefined without WILDBEAST_OFREP_URL', () => {
    expect(providerFromEnv({})).toBeUndefined()
  })

  it('builds an OFREP provider from the environment', () => {
    const provider = providerFromEnv({
      WILDBEAST_OFREP_URL: 'http://localhost:8016',
      WILDBEAST_OFREP_TOKEN: 'secret',
    })
    expect(provider?.metadata.name).toBeTruthy()
  })
})

describe.sequential('feature flag lifecycle', () => {
  // Ordered: the OpenFeature singleton is process-global, so these tests
  // walk one lifecycle — off, on with overrides, closed again.
  it('stays inactive when nothing is configured', async () => {
    expect(await initFeatureFlags({ logger: silentLogger })).toBe(false)
    expect(featureFlagsActive()).toBe(false)
    expect(await limitFor(fakeInteraction(), 'tags.maxPerGuild')).toBe(
      FREE_TAG_LIMIT,
    )
  })

  it('falls back to the registry value when no flag rule exists', async () => {
    const provider = new InMemoryProvider({})
    expect(await initFeatureFlags({ logger: silentLogger, provider })).toBe(
      true,
    )
    expect(featureFlagsActive()).toBe(true)
    expect(await limitFor(fakeInteraction(), 'tags.maxPerGuild')).toBe(
      FREE_TAG_LIMIT,
    )
  })

  it('lets the flag service override limits per guild', async () => {
    const provider = new InMemoryProvider({
      'limits.tags.maxPerGuild': {
        disabled: false,
        variants: { standard: FREE_TAG_LIMIT, boosted: 9_000 },
        defaultVariant: 'standard',
        contextEvaluator: (context) =>
          context.guildId === '42' ? 'boosted' : 'standard',
      },
    })
    await initFeatureFlags({ logger: silentLogger, provider })

    expect(await limitFor(fakeInteraction('42'), 'tags.maxPerGuild')).toBe(
      9_000,
    )
    expect(await limitFor(fakeInteraction('7'), 'tags.maxPerGuild')).toBe(
      FREE_TAG_LIMIT,
    )
  })

  it('returns to in-code defaults after close', async () => {
    await closeFeatureFlags()
    expect(featureFlagsActive()).toBe(false)
    expect(await limitFor(fakeInteraction('42'), 'tags.maxPerGuild')).toBe(
      FREE_TAG_LIMIT,
    )
  })
})

describe.sequential('OFREP-backed gates', () => {
  const precondition = new FeaturePrecondition(
    {
      name: 'Feature',
      path: fileURLToPath(import.meta.url),
      root: dirname(fileURLToPath(import.meta.url)),
      store: new PreconditionStore(),
    } as never,
    {},
  )

  it('allows a command when its gate resolves true', async () => {
    await initFeatureFlags({
      logger: silentLogger,
      provider: new InMemoryProvider({
        'features.commands.booru': {
          disabled: false,
          variants: { enabled: true },
          defaultVariant: 'enabled',
        },
      }),
    })

    const result = await precondition.chatInputRun(
      fakeInteraction(),
      { name: 'booru' } as never,
      { key: 'features.commands.booru' },
    )
    expect(result.isOk()).toBe(true)
  })

  it('denies a command with the feature identifier when its gate is off', async () => {
    await initFeatureFlags({
      logger: silentLogger,
      provider: new InMemoryProvider({
        'features.commands.booru': {
          disabled: false,
          variants: { disabled: false },
          defaultVariant: 'disabled',
        },
      }),
    })

    const result = await precondition.chatInputRun(
      fakeInteraction(),
      { name: 'booru' } as never,
      { key: 'features.commands.booru' },
    )
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr()).toMatchObject({
      identifier: FeaturePreconditionIdentifier,
      context: { key: 'features.commands.booru', command: 'booru' },
    })
  })

  it('uses the default-on gate when no provider is active', async () => {
    await closeFeatureFlags()
    await expect(
      booleanFlagValue('features.commands.booru', {
        targetingKey: 'guild:42',
      }),
    ).resolves.toBe(true)
  })

  it('suppresses autocomplete work while a command is disabled', async () => {
    await initFeatureFlags({
      logger: silentLogger,
      provider: new InMemoryProvider({
        'features.commands.booru': {
          disabled: false,
          variants: { disabled: false },
          defaultVariant: 'disabled',
        },
      }),
    })
    const autocompleteRun = vi.fn(async () => undefined)
    const append = vi.fn()
    const command = {
      name: 'booru',
      preconditions: { append },
      autocompleteRun,
    }
    installCommandFeatureGate(command as never)
    const respond = vi.fn(async () => undefined)

    await command.autocompleteRun({
      ...fakeInteraction(),
      respond,
    } as never)

    expect(append).toHaveBeenCalledWith({
      name: 'Feature',
      context: { key: 'features.commands.booru' },
    })
    expect(autocompleteRun).not.toHaveBeenCalled()
    expect(respond).toHaveBeenCalledWith([])
  })

  it('keeps stateless command components behind the command gate', async () => {
    await initFeatureFlags({
      logger: silentLogger,
      provider: new InMemoryProvider({
        'features.commands.booru': {
          disabled: false,
          variants: { disabled: false },
          defaultVariant: 'disabled',
        },
      }),
    })

    await expect(
      commandComponentEnabled(fakeInteraction('42'), 'booru'),
    ).resolves.toBe(false)
  })
})

class GatedFixtureTask extends TracedScheduledTask {
  public runs = 0

  public run(): string {
    this.runs += 1
    return 'ran'
  }
}

function gatedTask() {
  return new GatedFixtureTask(
    {
      name: 'metricsCollection',
      path: fileURLToPath(import.meta.url),
      root: dirname(fileURLToPath(import.meta.url)),
      store: new ScheduledTaskStore(),
    } as never,
    { interval: 60_000 } satisfies ScheduledTask.Options,
  )
}

describe.sequential('scheduled task gates', () => {
  it('skips the task body when its OFREP gate resolves false', async () => {
    await initFeatureFlags({
      logger: silentLogger,
      provider: new InMemoryProvider({
        'features.tasks.metricsCollection': {
          disabled: false,
          variants: { disabled: false },
          defaultVariant: 'disabled',
        },
      }),
    })
    const task = gatedTask()

    await expect(task.run()).resolves.toBeUndefined()
    expect(task.runs).toBe(0)
  })

  it('runs the task body when its gate resolves true', async () => {
    await initFeatureFlags({
      logger: silentLogger,
      provider: new InMemoryProvider({
        'features.tasks.metricsCollection': {
          disabled: false,
          variants: { enabled: true },
          defaultVariant: 'enabled',
        },
      }),
    })
    const task = gatedTask()

    await expect(task.run()).resolves.toBe('ran')
    expect(task.runs).toBe(1)
  })
})

describe.sequential('evaluation caching and provider health', () => {
  const gateProvider = (contextEvaluator: () => string) =>
    new InMemoryProvider({
      'features.commands.booru': {
        disabled: false,
        variants: { enabled: true, disabled: false },
        defaultVariant: 'disabled',
        contextEvaluator,
      },
    })

  it('reuses one provider resolution per flag and context within the TTL', async () => {
    const contextEvaluator = vi.fn(() => 'enabled')
    await initFeatureFlags({
      logger: silentLogger,
      provider: gateProvider(contextEvaluator),
    })

    const context = { targetingKey: 'guild:1', guildId: '1' }
    await expect(
      booleanFlagValue('features.commands.booru', context),
    ).resolves.toBe(true)
    await expect(
      booleanFlagValue('features.commands.booru', context),
    ).resolves.toBe(true)
    expect(contextEvaluator).toHaveBeenCalledTimes(1)

    // A different context is a different cache entry.
    await booleanFlagValue('features.commands.booru', {
      targetingKey: 'guild:2',
      guildId: '2',
    })
    expect(contextEvaluator).toHaveBeenCalledTimes(2)
  })

  it('evaluates every time when the cache TTL is zero', async () => {
    process.env.WILDBEAST_OFREP_CACHE_TTL = '0'
    const contextEvaluator = vi.fn(() => 'enabled')
    await initFeatureFlags({
      logger: silentLogger,
      provider: gateProvider(contextEvaluator),
    })
    delete process.env.WILDBEAST_OFREP_CACHE_TTL

    const context = { targetingKey: 'guild:1', guildId: '1' }
    await booleanFlagValue('features.commands.booru', context)
    await booleanFlagValue('features.commands.booru', context)
    expect(contextEvaluator).toHaveBeenCalledTimes(2)
  })

  it('stops calling the provider after repeated outages', async () => {
    const contextEvaluator = vi.fn((): string => {
      throw new Error('flag service is down')
    })
    await initFeatureFlags({
      logger: silentLogger,
      provider: gateProvider(contextEvaluator),
    })

    // Distinct contexts so the cache cannot absorb the calls. Every one
    // falls back to the default-on gate value.
    for (const guild of ['1', '2', '3', '4']) {
      await expect(
        booleanFlagValue('features.commands.booru', {
          targetingKey: `guild:${guild}`,
          guildId: guild,
        }),
      ).resolves.toBe(true)
    }
    // The breaker trips after three consecutive failures; the fourth
    // evaluation is served from cooldown without touching the provider.
    expect(contextEvaluator).toHaveBeenCalledTimes(3)
  })

  it('does not cache provider failures for the full value TTL', async () => {
    const contextEvaluator = vi.fn((): string => {
      throw new Error('temporary flag service failure')
    })
    await initFeatureFlags({
      logger: silentLogger,
      provider: gateProvider(contextEvaluator),
    })

    const context = { targetingKey: 'guild:1', guildId: '1' }
    for (let attempt = 0; attempt < 4; attempt++) {
      await expect(
        booleanFlagValue('features.commands.booru', context),
      ).resolves.toBe(true)
    }

    // Three live failures trip the breaker. The fourth call is cooldown,
    // proving the first fallback was evicted instead of cached for 30s.
    expect(contextEvaluator).toHaveBeenCalledTimes(3)
  })

  it('serves a fresh cached kill switch while the breaker is cooling down', async () => {
    const contextEvaluator = vi.fn((context: { guildId?: string }) => {
      if (context.guildId === 'kill-switched') return 'disabled'
      throw new Error('flag service is down')
    })
    await initFeatureFlags({
      logger: silentLogger,
      provider: gateProvider(contextEvaluator as never),
    })

    const killed = {
      targetingKey: 'guild:kill-switched',
      guildId: 'kill-switched',
    }
    await expect(
      booleanFlagValue('features.commands.booru', killed),
    ).resolves.toBe(false)
    for (const guildId of ['2', '3', '4']) {
      await booleanFlagValue('features.commands.booru', {
        targetingKey: `guild:${guildId}`,
        guildId,
      })
    }

    await expect(
      booleanFlagValue('features.commands.booru', killed),
    ).resolves.toBe(false)
    expect(contextEvaluator).toHaveBeenCalledTimes(4)
  })

  it('serves the last good value during cooldown when no fresh cache exists', async () => {
    // TTL 0 disables the fresh cache entirely, so the second kill-switch
    // read below can only be answered by the stale-on-error store.
    process.env.WILDBEAST_OFREP_CACHE_TTL = '0'
    const contextEvaluator = vi.fn((context: { guildId?: string }) => {
      if (context.guildId === 'kill-switched') return 'disabled'
      throw new Error('flag service is down')
    })
    await initFeatureFlags({
      logger: silentLogger,
      provider: gateProvider(contextEvaluator as never),
    })
    delete process.env.WILDBEAST_OFREP_CACHE_TTL

    const killed = {
      targetingKey: 'guild:kill-switched',
      guildId: 'kill-switched',
    }
    await expect(
      booleanFlagValue('features.commands.booru', killed),
    ).resolves.toBe(false)
    for (const guildId of ['2', '3', '4']) {
      await booleanFlagValue('features.commands.booru', {
        targetingKey: `guild:${guildId}`,
        guildId,
      })
    }

    await expect(
      booleanFlagValue('features.commands.booru', killed),
    ).resolves.toBe(false)
    expect(contextEvaluator).toHaveBeenCalledTimes(4)
  })
})
