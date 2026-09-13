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

export type ExperimentCompletion = 'return' | 'event'
type Outcome = 'success' | 'error'

interface Assignment {
  pending: Promise<string>
  variant?: string
}

interface ExperimentScope {
  operation: ExperimentOperation
  completion: ExperimentCompletion
  assignments: Map<ExperimentFlagKey, Assignment>
  outcome?: Outcome
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
    if (existing) return existing.pending as Promise<ExperimentVariant<Key>>

    const assignment: Assignment = {
      pending: this.evaluate(key, context).then((variant) => {
        assignment.variant = variant
        // An event may complete the operation while evaluation is pending.
        if (scope?.outcome) this.recordOutcome(scope, key, variant)
        return variant
      }),
    }
    scope?.assignments.set(key, assignment)
    return assignment.pending as Promise<ExperimentVariant<Key>>
  }

  private async evaluate<Key extends ExperimentFlagKey>(
    key: Key,
    context: EvaluationContext,
  ): Promise<ExperimentVariant<Key>> {
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
    return variant as ExperimentVariant<Key>
  }

  /** Called by framework listeners only for operations completed by events. */
  public completeFromEvent(outcome: Outcome): void {
    const scope = this.scope.getStore()
    if (scope?.completion === 'event') this.finish(scope, outcome)
  }

  private finish(scope: ExperimentScope, outcome: Outcome): void {
    if (scope.outcome) return
    scope.outcome = outcome
    for (const [key, assignment] of scope.assignments) {
      if (assignment.variant !== undefined)
        this.recordOutcome(scope, key, assignment.variant)
    }
  }

  private recordOutcome(
    scope: ExperimentScope,
    experiment: ExperimentFlagKey,
    variant: string,
  ): void {
    outcomeCounter.add(1, {
      experiment,
      variant,
      outcome: scope.outcome,
      operation_kind: scope.operation.kind,
      operation: scope.operation.name,
    })
  }

  /** Nested wrappers share the outer scope so dispatch cannot double count. */
  public async run<Result>(
    operation: ExperimentOperation,
    work: () => Promise<Result> | Result,
    completion: ExperimentCompletion = 'return',
  ): Promise<Result> {
    if (this.scope.getStore()) return work()
    const scope: ExperimentScope = {
      operation,
      completion,
      assignments: new Map(),
    }
    return this.scope.run(scope, async () => {
      try {
        const result = await work()
        if (completion === 'return') this.finish(scope, 'success')
        return result
      } catch (error) {
        // A dispatcher can throw before it gets a chance to emit an event.
        this.finish(scope, 'error')
        throw error
      }
    })
  }
}
