import { AsyncLocalStorage } from 'node:async_hooks'
import type { EvaluationContext } from '@openfeature/server-sdk'
import { metrics } from '@thesharks/analytics'
import { evaluationSource, experimentFlagDetails } from './client.mjs'
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

const experimentScope = new AsyncLocalStorage<ExperimentScope>()
const meter = metrics.getMeter('@thesharks/discord')
const exposureCounter = meter.createCounter(
  'discord_experiment_exposures_total',
  { description: 'Experiment variant exposures' },
)
const outcomeCounter = meter.createCounter(
  'discord_experiment_outcomes_total',
  { description: 'Technical outcomes for operations exposed to experiments' },
)

/**
 * Resolve and record one experiment assignment. Repeated reads of the same
 * experiment during a command/task return the first assignment without a
 * second provider call or duplicate exposure.
 */
export async function experimentVariant<Key extends ExperimentFlagKey>(
  key: Key,
  context: EvaluationContext,
): Promise<ExperimentVariant<Key>> {
  const scope = experimentScope.getStore()
  const existing = scope?.assignments.get(key)
  if (existing !== undefined) return existing as ExperimentVariant<Key>

  const definition = getFlagDefinition(key)
  const details = await experimentFlagDetails(key, context)
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

function recordOutcomes(
  scope: ExperimentScope,
  outcome: 'success' | 'error',
): void {
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

/** Complete the active operation from a framework event that owns the real
 * success/error boundary. The subcommands plugin catches mapped-method errors,
 * so its success/error listeners call this while the dispatcher scope is
 * still active. */
export function completeExperimentOutcomes(outcome: 'success' | 'error'): void {
  const scope = experimentScope.getStore()
  if (!scope || scope.completed) return
  scope.completed = true
  recordOutcomes(scope, outcome)
}

/** Run an operation in an experiment scope and attach its success/error to
 * every variant actually read inside it. Nested wrappers share the outer
 * scope so subcommand dispatch cannot double-count outcomes. */
export async function withExperimentOutcomes<Result>(
  operation: ExperimentOperation,
  run: () => Promise<Result> | Result,
  options: { automatic?: boolean } = {},
): Promise<Result> {
  if (experimentScope.getStore()) return run()

  const scope: ExperimentScope = {
    operation,
    assignments: new Map(),
    completed: false,
  }
  return experimentScope.run(scope, async () => {
    try {
      const result = await run()
      if (options.automatic !== false) completeExperimentOutcomes('success')
      return result
    } catch (error) {
      if (options.automatic !== false) completeExperimentOutcomes('error')
      throw error
    }
  })
}
