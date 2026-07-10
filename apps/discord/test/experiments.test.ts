import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { InMemoryProvider } from '@openfeature/server-sdk'
import { CommandStore, container, ListenerStore } from '@sapphire/framework'
import { captureMetrics, silentLogger } from '@thesharks/test-utils'
import { afterAll, describe, expect, it, vi } from 'vitest'

// Runtime-policy instruments are created at module scope, so install the
// metric capture before importing the modules under test.
const metricCapture = captureMetrics('delta')
const { closeFeatureFlags, initFeatureFlags } = await import(
  '../src/features/client.mjs'
)
const {
  completeExperimentOutcomes,
  experimentVariant,
  withExperimentOutcomes,
} = await import('../src/features/experiments.mjs')
const { TracedSubcommand } = await import('../src/structures/subcommand.mjs')
const { SubcommandExecutedListener } = await import(
  '../src/listeners/metrics/subcommandExecuted.mjs'
)
const { SubcommandErrorListener } = await import(
  '../src/listeners/metrics/subcommandError.mjs'
)

afterAll(async () => {
  await closeFeatureFlags()
  await metricCapture.shutdown()
})

async function collectMetrics() {
  const batches = await metricCapture.collect()
  const metrics = new Map<
    string,
    Array<{ attributes: Record<string, unknown>; value: number }>
  >()
  for (const scope of batches.at(-1)?.scopeMetrics ?? []) {
    for (const metric of scope.metrics) {
      metrics.set(
        metric.descriptor.name,
        metric.dataPoints as Array<{
          attributes: Record<string, unknown>
          value: number
        }>,
      )
    }
  }
  return metrics
}

describe.sequential('experiment assignment', () => {
  it('uses and records the registry default without a provider', async () => {
    await closeFeatureFlags()

    await expect(
      experimentVariant('experiments.tags.notFoundReply', {
        targetingKey: 'guild:1',
      }),
    ).resolves.toBe('suggestion')

    const metrics = await collectMetrics()
    expect(
      metrics.get('discord_feature_flag_evaluations_total'),
    ).toContainEqual(
      expect.objectContaining({
        attributes: {
          flag: 'experiments.tags.notFoundReply',
          kind: 'experiment',
          source: 'default',
        },
        value: 1,
      }),
    )
    expect(metrics.get('discord_experiment_exposures_total')).toContainEqual(
      expect.objectContaining({
        attributes: {
          experiment: 'experiments.tags.notFoundReply',
          source: 'default',
          variant: 'suggestion',
        },
        value: 1,
      }),
    )
  })

  it('targets a variant, records one exposure, and attributes success', async () => {
    const contextEvaluator = vi.fn((context: { guildId?: unknown }) =>
      context.guildId === '42' ? 'plain' : 'suggestion',
    )
    await initFeatureFlags({
      logger: silentLogger,
      provider: new InMemoryProvider({
        'experiments.tags.notFoundReply': {
          disabled: false,
          variants: { plain: 'plain', suggestion: 'suggestion' },
          defaultVariant: 'suggestion',
          contextEvaluator,
        },
      }),
    })

    await withExperimentOutcomes({ kind: 'command', name: 'tag' }, async () => {
      const context = { targetingKey: '42', guildId: '42' }
      expect(
        await experimentVariant('experiments.tags.notFoundReply', context),
      ).toBe('plain')
      // A second read inside one operation is stable and not a new exposure.
      expect(
        await experimentVariant('experiments.tags.notFoundReply', context),
      ).toBe('plain')
    })

    expect(contextEvaluator).toHaveBeenCalledTimes(1)
    const metrics = await collectMetrics()
    expect(metrics.get('discord_experiment_exposures_total')).toContainEqual(
      expect.objectContaining({
        attributes: {
          experiment: 'experiments.tags.notFoundReply',
          source: 'provider',
          variant: 'plain',
        },
        value: 1,
      }),
    )
    expect(metrics.get('discord_experiment_outcomes_total')).toContainEqual(
      expect.objectContaining({
        attributes: {
          experiment: 'experiments.tags.notFoundReply',
          operation: 'tag',
          operation_kind: 'command',
          outcome: 'success',
          variant: 'plain',
        },
        value: 1,
      }),
    )
  })

  it('attributes thrown operations as experiment errors', async () => {
    await expect(
      withExperimentOutcomes({ kind: 'command', name: 'tag' }, async () => {
        await experimentVariant('experiments.tags.notFoundReply', {
          targetingKey: '42',
          guildId: '42',
        })
        throw new Error('experiment fixture failed')
      }),
    ).rejects.toThrow('experiment fixture failed')

    const metrics = await collectMetrics()
    expect(metrics.get('discord_experiment_outcomes_total')).toContainEqual(
      expect.objectContaining({
        attributes: {
          experiment: 'experiments.tags.notFoundReply',
          operation: 'tag',
          operation_kind: 'command',
          outcome: 'error',
          variant: 'plain',
        },
        value: 1,
      }),
    )
  })

  it('lets a framework event complete a manually managed outcome scope', async () => {
    await withExperimentOutcomes(
      { kind: 'command', name: 'tag.show' },
      async () => {
        await experimentVariant('experiments.tags.notFoundReply', {
          targetingKey: '42',
          guildId: '42',
        })
        completeExperimentOutcomes('error')
      },
      { automatic: false },
    )

    const metrics = await collectMetrics()
    expect(metrics.get('discord_experiment_outcomes_total')).toContainEqual(
      expect.objectContaining({
        attributes: {
          experiment: 'experiments.tags.notFoundReply',
          operation: 'tag.show',
          operation_kind: 'command',
          outcome: 'error',
          variant: 'plain',
        },
        value: 1,
      }),
    )
  })

  it('rejects unknown provider variants in favor of the typed default', async () => {
    await initFeatureFlags({
      logger: silentLogger,
      provider: new InMemoryProvider({
        'experiments.tags.notFoundReply': {
          disabled: false,
          variants: { unknown: 'not-in-the-registry' },
          defaultVariant: 'unknown',
        },
      }),
    })

    await expect(
      experimentVariant('experiments.tags.notFoundReply', {
        targetingKey: 'guild:1',
      }),
    ).resolves.toBe('suggestion')

    const metrics = await collectMetrics()
    expect(metrics.get('discord_experiment_exposures_total')).toContainEqual(
      expect.objectContaining({
        attributes: {
          experiment: 'experiments.tags.notFoundReply',
          source: 'invalid',
          variant: 'suggestion',
        },
        value: 1,
      }),
    )
  })
})

/**
 * The outcome contract between TracedSubcommand (which opens the scope with
 * automatic completion disabled) and the subcommand metrics listeners (which
 * complete it from the plugin's success/error events) is invisible at either
 * site. This drives a real dispatcher through real listener instances to pin
 * that the events fire inside the AsyncLocalStorage scope.
 */
describe.sequential('outcome attribution through the real dispatcher', () => {
  it('completes scopes from the subcommand success and error events', async () => {
    // No provider: the variant deterministically resolves to the default.
    await closeFeatureFlags()

    const fakeClient = Object.assign(new EventEmitter(), { options: {} })
    container.client = fakeClient as never
    container.logger = silentLogger

    const loaderContext = (name: string, store: unknown) =>
      ({
        name,
        path: fileURLToPath(import.meta.url),
        root: dirname(fileURLToPath(import.meta.url)),
        store,
      }) as never

    const successListener = new SubcommandExecutedListener(
      loaderContext('subcommandExecuted', new ListenerStore()),
      {},
    )
    const errorListener = new SubcommandErrorListener(
      loaderContext('subcommandError', new ListenerStore()),
      {},
    )
    fakeClient.on('chatInputSubcommandSuccess', (...args) =>
      successListener.run(...(args as Parameters<typeof successListener.run>)),
    )
    fakeClient.on('chatInputSubcommandError', (...args) =>
      errorListener.run(...(args as Parameters<typeof errorListener.run>)),
    )

    class OutcomeFixtureSubcommand extends TracedSubcommand {
      public behavior: 'succeed' | 'fail' = 'succeed'

      public async chatInputShow(): Promise<string> {
        await experimentVariant('experiments.tags.notFoundReply', {
          targetingKey: 'guild:9',
        })
        if (this.behavior === 'fail') {
          throw new Error('outcome fixture failure')
        }
        return 'ok'
      }
    }
    const fixture = new OutcomeFixtureSubcommand(
      loaderContext('outcomefixture', new CommandStore()),
      { subcommands: [{ name: 'show', chatInputRun: 'chatInputShow' }] },
    )

    const fakeInteraction = () => ({
      id: '1234567890',
      type: 2,
      commandName: 'outcomefixture',
      user: { id: 'u-1', tag: 'tester#0' },
      channelId: 'c-1',
      guild: null,
      guildId: null,
      inGuild: () => false,
      createdTimestamp: Date.now(),
      options: {
        getSubcommand: () => 'show',
        getSubcommandGroup: () => null,
      },
    })

    // The dispatcher converts mapped-method throws into events, so both
    // invocations resolve; outcomes must come from the listeners.
    // biome-ignore lint/suspicious/noExplicitAny: intentionally minimal fake
    await (fixture.chatInputRun as any)(fakeInteraction(), {})
    fixture.behavior = 'fail'
    // biome-ignore lint/suspicious/noExplicitAny: intentionally minimal fake
    await (fixture.chatInputRun as any)(fakeInteraction(), {})

    const metrics = await collectMetrics()
    const outcomes = metrics.get('discord_experiment_outcomes_total')
    for (const outcome of ['success', 'error'] as const) {
      expect(outcomes).toContainEqual(
        expect.objectContaining({
          attributes: {
            experiment: 'experiments.tags.notFoundReply',
            variant: 'suggestion',
            outcome,
            operation_kind: 'command',
            operation: 'outcomefixture.show',
          },
          value: 1,
        }),
      )
    }
  })
})
