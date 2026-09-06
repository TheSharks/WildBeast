import { AsyncLocalStorage } from 'node:async_hooks'
import type { EvaluationContext } from '@openfeature/server-sdk'
import { metrics } from '@thesharks/analytics'
import { evaluationSource, type FeatureFlags } from './flags.mjs'
import {
  type ExperimentFlagKey,
  type ExperimentVariant,
  getFlagDefinition,
} from './registry.mjs'

export interface ExperimentOperation {
  kind: 'command' | 'task'
  name: string
}

interface ExperimentScope {
  operation: ExperimentOperation
  assignments: Map<ExperimentFlagKey, string>
  completed: boolean
}

const meter = metrics.getMeter('@thesharks/discord')
const exposureCounter = meter.createCounter(
  'discord_experiment_exposures_total',
  { description: 'Experiment variant exposures' },
)
const outcomeCounter = meter.createCounter(
  'discord_experiment_outcomes_total',
  { description: 'Technical outcomes for operations exposed to experiments' },
)

/** One assignment per experiment per operation, with the outcome attributed to it. */
export class Experiments {
  private readonly scope = new AsyncLocalStorage<ExperimentScope>()

  public constructor(private readonly flags: FeatureFlags) {}

  public async variant<Key extends ExperimentFlagKey>(
    key: Key,
    context: EvaluationContext,
  ): Promise<ExperimentVariant<Key>> {
    const scope = this.scope.getStore()
    const existing = scope?.assignments.get(key)
    if (existing !== undefined) return existing as ExperimentVariant<Key>
    const definition = getFlagDefinition(key)
    const details = await this.flags.experiment(key, context)
    const valid = (definition.variants as readonly string[]).includes(
      details.value,
    )
    const variant = valid ? details.value : definition.defaultValue
    exposureCounter.add(1, {
      experiment: key,
      variant,
      source: valid ? evaluationSource(details) : 'invalid',
    })
    scope?.assignments.set(key, variant)
    return variant as ExperimentVariant<Key>
  }

  /** Framework events that own the real success/error boundary call this. */
  public complete(outcome: 'success' | 'error'): void {
    const scope = this.scope.getStore()
    if (!scope || scope.completed) return
    scope.completed = true
    for (const [experiment, variant] of scope.assignments) {
      outcomeCounter.add(1, {
        experiment,
        variant,
        outcome,
        operation_kind: scope.operation.kind,
        operation: scope.operation.name,
      })
    }
  }

  /** Nested wrappers share the outer scope so dispatch cannot double count. */
  public async run<Result>(
    operation: ExperimentOperation,
    work: () => Promise<Result> | Result,
    options: { automatic?: boolean } = {},
  ): Promise<Result> {
    if (this.scope.getStore()) return work()
    const scope: ExperimentScope = {
      operation,
      assignments: new Map(),
      completed: false,
    }
    return this.scope.run(scope, async () => {
      try {
        const result = await work()
        if (options.automatic !== false) this.complete('success')
        return result
      } catch (error) {
        if (options.automatic !== false) this.complete('error')
        throw error
      }
    })
  }
}
