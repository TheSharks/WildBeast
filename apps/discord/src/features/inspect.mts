import type {
  EvaluationContext,
  EvaluationDetails,
  FlagValue,
} from '@openfeature/server-sdk'
import {
  describeLimit,
  getLimit,
  type LimitKey,
  limitFlagKey,
  limitKeys,
  UNLIMITED,
} from '../premium/limits.mjs'
import {
  FREE_TIER,
  isPremiumTier,
  type PremiumTier,
} from '../premium/tiers.mjs'
import {
  booleanFlagDetails,
  type EvaluationSource,
  evaluationSource,
  experimentFlagDetails,
  limitFlagDetails,
} from './client.mjs'
import {
  type ExperimentFlagKey,
  type FlagKey,
  flagKeys,
  type GateFlagKey,
  getFlagDefinition,
} from './registry.mjs'

/**
 * The owner-facing view of the runtime flag surface: every registered gate
 * and experiment plus every `limits.*` flag from the premium registry,
 * evaluated live. Evaluation dispatch lives here so the /flags command
 * stays thin and the formatting is testable without Discord.
 */

export interface FlagInspection {
  key: string
  kind: 'gate' | 'experiment' | 'limit'
  owner: string
  description: string
  /** The evaluated value, already formatted for humans. */
  value: string
  source: EvaluationSource
  /** Present on evaluation failure. */
  errorMessage?: string
  expiresAt?: string
  expired: boolean
  /** The in-code fallback, formatted like `value`. */
  defaultValue: string
  /** Experiment variants, when applicable. */
  variants?: readonly string[]
}

/** Every key /flags can evaluate, for autocomplete and validation. */
export function inspectableKeys(): string[] {
  return [...flagKeys, ...limitKeys.map((key) => limitFlagKey(key))]
}

export async function inspectFlag(
  key: string,
  context: EvaluationContext,
): Promise<FlagInspection | undefined> {
  const limitKey = limitKeys.find(
    (candidate) => limitFlagKey(candidate) === key,
  )
  if (limitKey) return inspectLimit(limitKey, context)
  if ((flagKeys as string[]).includes(key)) {
    return inspectRegistered(key as FlagKey, context)
  }
  return undefined
}

export async function inspectAllFlags(
  context: EvaluationContext,
): Promise<FlagInspection[]> {
  return Promise.all([
    ...flagKeys.map((key) => inspectRegistered(key, context)),
    ...limitKeys.map((key) => inspectLimit(key, context)),
  ])
}

async function inspectRegistered(
  key: FlagKey,
  context: EvaluationContext,
): Promise<FlagInspection> {
  const definition = getFlagDefinition(key)
  const details =
    definition.kind === 'gate'
      ? await booleanFlagDetails(key as GateFlagKey, context)
      : await experimentFlagDetails(key as ExperimentFlagKey, context)
  return {
    key,
    kind: definition.kind,
    owner: definition.owner,
    description: definition.description,
    value: formatValue(details.value),
    ...evaluationFields(details),
    expiresAt: definition.expiresAt,
    expired: isExpired(definition.expiresAt),
    defaultValue: formatValue(definition.defaultValue),
    ...(definition.kind === 'experiment'
      ? { variants: definition.variants }
      : {}),
  }
}

async function inspectLimit(
  key: LimitKey,
  context: EvaluationContext,
): Promise<FlagInspection> {
  const definition = describeLimit(key)
  const tier = tierFromContext(context)
  const fallback = getLimit(key, tier)
  const details = await limitFlagDetails(limitFlagKey(key), fallback, context)
  return {
    key: limitFlagKey(key),
    kind: 'limit',
    owner: 'premium',
    description: `${definition.description} (${definition.scope} scope, evaluated at tier ${tier})`,
    value: formatValue(details.value),
    ...evaluationFields(details),
    expired: false,
    defaultValue: formatValue(fallback),
  }
}

/** The tier attribute contexts carry, or the free baseline. Limits need a
 * concrete tier to pick their fallback from the registry. */
function tierFromContext(context: EvaluationContext): PremiumTier {
  const tier = context.tier
  return typeof tier === 'string' && isPremiumTier(tier) ? tier : FREE_TIER
}

function evaluationFields(details: EvaluationDetails<FlagValue>): {
  source: EvaluationSource
  errorMessage?: string
} {
  return {
    source: evaluationSource(details),
    ...(details.errorMessage ? { errorMessage: details.errorMessage } : {}),
  }
}

function formatValue(value: FlagValue): string {
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled'
  if (value === UNLIMITED) return 'unlimited'
  return String(value)
}

function isExpired(expiresAt: string | undefined, now = new Date()): boolean {
  return expiresAt !== undefined && Date.parse(expiresAt) <= now.getTime()
}

/**
 * The /flags list body, chunked to fit Discord's 2000-character message
 * limit. Expired flags are pinned to a warning section on top — they're the
 * reason an operator is usually here.
 */
export function formatFlagList(
  inspections: readonly FlagInspection[],
): string[] {
  const expired = inspections.filter((inspection) => inspection.expired)
  const live = inspections.filter((inspection) => !inspection.expired)

  const lines: string[] = []
  if (expired.length > 0) {
    lines.push(`⚠️ ${expired.length} flag(s) past expiry:`)
    lines.push(...expired.map((inspection) => flagLine(inspection)))
    lines.push('')
  }
  lines.push(...live.map((inspection) => flagLine(inspection)))
  return chunkLines(lines, 1_900)
}

/** Full detail for one flag, for /flags inspect. */
export function formatFlagDetail(inspection: FlagInspection): string {
  const lines = [
    `\`${inspection.key}\` (${inspection.kind}, owner: ${inspection.owner})`,
    inspection.description,
    `value: **${inspection.value}** (${inspection.source})`,
    `default: ${inspection.defaultValue}`,
  ]
  if (inspection.variants) {
    lines.push(`variants: ${inspection.variants.join(', ')}`)
  }
  if (inspection.expiresAt) {
    lines.push(
      `${inspection.expired ? '⚠️ expired' : 'expires'}: ${inspection.expiresAt}`,
    )
  }
  if (inspection.errorMessage) {
    lines.push(`error: ${inspection.errorMessage}`)
  }
  return lines.join('\n')
}

function flagLine(inspection: FlagInspection): string {
  const expiry = inspection.expired ? ' ⚠️ expired' : ''
  const error = inspection.errorMessage ? ` — ${inspection.errorMessage}` : ''
  return `\`${inspection.key}\` ${inspection.kind}: **${inspection.value}** (${inspection.source})${expiry}${error}`
}

function chunkLines(lines: readonly string[], maxLength: number): string[] {
  const chunks: string[] = []
  let current = ''
  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line
    if (candidate.length > maxLength && current) {
      chunks.push(current)
      current = line
    } else {
      current = candidate
    }
  }
  if (current) chunks.push(current)
  return chunks
}
