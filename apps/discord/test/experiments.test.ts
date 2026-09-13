import { captureMetrics } from '@thesharks/test-utils'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatureFlags } from '../src/features/flags.mjs'

const metrics = captureMetrics('delta')
const { Experiments } = await import('../src/features/experiments.mjs')
const key = 'experiments.tags.notFoundReply'
const context = { targetingKey: 'guild:1' }
const operation = { kind: 'command', name: 'tag.show' } as const
const exposures = 'discord_experiment_exposures_total'
const outcomes = 'discord_experiment_outcomes_total'

let flags: FeatureFlags
let experiments: InstanceType<typeof Experiments>

beforeEach(async () => {
  await metrics.collect()
  metrics.reset()
  flags = new FeatureFlags()
  experiments = new Experiments(flags)
})
afterAll(() => metrics.shutdown())

async function points(name: string) {
  return (await metrics.collect()).flatMap((batch) =>
    batch.scopeMetrics.flatMap((scope) =>
      scope.metrics
        .filter((metric) => metric.descriptor.name === name)
        .flatMap((metric) =>
          metric.dataPoints.map(({ attributes, value }) => ({
            attributes,
            value,
          })),
        ),
    ),
  )
}

describe('experiment assignments', () => {
  it('shares one pending evaluation and exposure across concurrent and repeated reads', async () => {
    const evaluate = vi.spyOn(flags, 'experiment')
    await experiments.run(operation, async () => {
      expect(
        await Promise.all([
          experiments.variant(key, context),
          experiments.variant(key, context),
        ]),
      ).toEqual(['suggestion', 'suggestion'])
      expect(await experiments.variant(key, context)).toBe('suggestion')
    })
    expect(evaluate).toHaveBeenCalledTimes(1)
    expect(await points(exposures)).toEqual([
      {
        value: 1,
        attributes: {
          experiment: key,
          variant: 'suggestion',
          source: 'default',
        },
      },
    ])
  })

  it('falls back from invalid variants and attributes the outcome to the default', async () => {
    const details = await flags.experiment(key, context)
    vi.spyOn(flags, 'experiment').mockResolvedValue({
      ...details,
      value: 'invalid',
    } as never)
    await experiments.run(operation, async () => {
      expect(await experiments.variant(key, context)).toBe('suggestion')
    })
    // Inspect both counters in one collection: this reader reports deltas.
    const batches = await metrics.collect()
    const emitted = batches.flatMap((batch) =>
      batch.scopeMetrics.flatMap((scope) => scope.metrics),
    )
    expect(
      emitted.find((metric) => metric.descriptor.name === exposures)
        ?.dataPoints,
    ).toEqual([
      expect.objectContaining({
        value: 1,
        attributes: {
          experiment: key,
          variant: 'suggestion',
          source: 'invalid',
        },
      }),
    ])
    expect(
      emitted.find((metric) => metric.descriptor.name === outcomes)?.dataPoints,
    ).toEqual([
      expect.objectContaining({
        value: 1,
        attributes: expect.objectContaining({
          variant: 'suggestion',
          outcome: 'success',
        }),
      }),
    ])
  })

  it('isolates assignments and outcomes between concurrent operations', async () => {
    const details = await flags.experiment(key, context)
    const evaluate = vi
      .spyOn(flags, 'experiment')
      .mockResolvedValueOnce({ ...details, value: 'plain' })
      .mockResolvedValueOnce({ ...details, value: 'suggestion' })
    const result = await Promise.all(
      ['first', 'second'].map((name) =>
        experiments.run({ kind: 'command', name }, () =>
          experiments.variant(key, context),
        ),
      ),
    )
    expect(result).toEqual(['plain', 'suggestion'])
    expect(evaluate).toHaveBeenCalledTimes(2)
    expect(await points(outcomes)).toEqual(
      expect.arrayContaining([
        {
          value: 1,
          attributes: {
            experiment: key,
            variant: 'plain',
            outcome: 'success',
            operation_kind: 'command',
            operation: 'first',
          },
        },
        {
          value: 1,
          attributes: {
            experiment: key,
            variant: 'suggestion',
            outcome: 'success',
            operation_kind: 'command',
            operation: 'second',
          },
        },
      ]),
    )
  })

  it('records exposures outside an operation without inventing an outcome', async () => {
    await experiments.variant(key, context)
    expect(await points(outcomes)).toEqual([])
  })
})

describe('experiment completion', () => {
  it.each(['command', 'task'] as const)(
    'records a successful %s return',
    async (kind) => {
      const result = await experiments.run({ ...operation, kind }, async () => {
        await experiments.variant(key, context)
        return 'result'
      })
      expect(result).toBe('result')
      expect(await points(outcomes)).toEqual([
        {
          value: 1,
          attributes: {
            experiment: key,
            variant: 'suggestion',
            outcome: 'success',
            operation_kind: kind,
            operation: operation.name,
          },
        },
      ])
    },
  )

  it.each(['return', 'event'] as const)(
    'records and rethrows errors with %s completion',
    async (completion) => {
      const failure = new Error('operation failed')
      await expect(
        experiments.run(
          operation,
          async () => {
            await experiments.variant(key, context)
            throw failure
          },
          completion,
        ),
      ).rejects.toBe(failure)
      expect(await points(outcomes)).toEqual([
        { value: 1, attributes: expect.objectContaining({ outcome: 'error' }) },
      ])
    },
  )

  it('does not infer success when an event-driven dispatcher returns', async () => {
    await experiments.run(
      operation,
      () => experiments.variant(key, context),
      'event',
    )
    expect(await points(outcomes)).toEqual([])
  })

  it('accepts the first event outcome without overwriting or double counting it', async () => {
    await experiments.run(
      operation,
      async () => {
        await experiments.variant(key, context)
        experiments.completeFromEvent('error')
        experiments.completeFromEvent('success')
      },
      'event',
    )
    expect(await points(outcomes)).toEqual([
      { value: 1, attributes: expect.objectContaining({ outcome: 'error' }) },
    ])
  })

  it('keeps nested work in the outer scope and ignores events in return-driven work', async () => {
    const evaluate = vi.spyOn(flags, 'experiment')
    await experiments.run(operation, async () => {
      await experiments.variant(key, context)
      await experiments.run(
        { kind: 'task', name: 'nested' },
        async () => {
          await experiments.variant(key, context)
          experiments.completeFromEvent('error')
        },
        'event',
      )
    })
    expect(evaluate).toHaveBeenCalledTimes(1)
    expect(await points(outcomes)).toEqual([
      {
        value: 1,
        attributes: expect.objectContaining({
          outcome: 'success',
          operation: operation.name,
          operation_kind: 'command',
        }),
      },
    ])
  })

  it('does not let a nested return complete an outer event-driven operation', async () => {
    await experiments.run(
      operation,
      async () => {
        await experiments.run({ kind: 'task', name: 'nested' }, () =>
          experiments.variant(key, context),
        )
        experiments.completeFromEvent('error')
      },
      'event',
    )
    expect(await points(outcomes)).toEqual([
      {
        value: 1,
        attributes: expect.objectContaining({
          outcome: 'error',
          operation: operation.name,
        }),
      },
    ])
  })

  it('attributes an assignment that resolves after the completion event exactly once', async () => {
    const details = await flags.experiment(key, context)
    const evaluation = Promise.withResolvers<typeof details>()
    vi.spyOn(flags, 'experiment').mockReturnValue(evaluation.promise)
    await experiments.run(
      operation,
      async () => {
        const assignment = experiments.variant(key, context)
        experiments.completeFromEvent('success')
        evaluation.resolve(details)
        await assignment
        experiments.completeFromEvent('success')
      },
      'event',
    )
    expect(await points(outcomes)).toEqual([
      { value: 1, attributes: expect.objectContaining({ outcome: 'success' }) },
    ])
  })

  it('does not record outcomes for operations without exposures', async () => {
    await experiments.run(operation, () => undefined)
    experiments.completeFromEvent('success')
    expect(await points(outcomes)).toEqual([])
  })
})
