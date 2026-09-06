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
} from '../premium/limits.mjs'
import type { Tier } from '../premium/model.mjs'
import {
  type EvaluationSource,
  evaluationSource,
  type FeatureFlags,
} from './flags.mjs'
import {
  type ExperimentFlagKey,
  type FlagDefinition,
  type FlagKey,
  flagKeys,
  type GateFlagKey,
  getFlagDefinition,
  type SettingFlagKey,
} from './registry.mjs'

/** Owner-facing live view of gates, experiments and limits. */
export interface FlagInspection {
  key: string
  kind: 'gate' | 'experiment' | 'setting' | 'limit'
  owner: string
  description: string
  value: string
  source: EvaluationSource
  errorMessage?: string
  expiresAt?: string
  expired: boolean
  defaultValue: string
  variants?: readonly string[]
}

export function inspectableKeys(): string[] {
  return [...flagKeys, ...limitKeys.map((key) => limitFlagKey(key))]
}

export async function inspectFlag(
  flags: FeatureFlags,
  key: string,
  context: EvaluationContext,
): Promise<FlagInspection | undefined> {
  const limitKey = limitKeys.find(
    (candidate) => limitFlagKey(candidate) === key,
  )
  if (limitKey) return inspectLimit(flags, limitKey, context)
  if ((flagKeys as string[]).includes(key))
    return inspectRegistered(flags, key as FlagKey, context)
  return undefined
}

export function inspectAllFlags(
  flags: FeatureFlags,
  context: EvaluationContext,
): Promise<FlagInspection[]> {
  return Promise.all([
    ...flagKeys.map((key) => inspectRegistered(flags, key, context)),
    ...limitKeys.map((key) => inspectLimit(flags, key, context)),
  ])
}

async function inspectRegistered(
  flags: FeatureFlags,
  key: FlagKey,
  context: EvaluationContext,
): Promise<FlagInspection> {
  const definition = getFlagDefinition(key) as FlagDefinition
  const details =
    definition.kind === 'gate'
      ? await flags.gate(key as GateFlagKey, context)
      : definition.kind === 'setting'
        ? await flags.setting(key as SettingFlagKey, context)
        : await flags.experiment(key as ExperimentFlagKey, context)
  return {
    key,
    kind: definition.kind,
    owner: definition.owner,
    description: definition.description,
    value: formatValue(details.value),
    ...evaluationFields(details),
    ...(definition.expiresAt ? { expiresAt: definition.expiresAt } : {}),
    expired: isExpired(definition.expiresAt),
    defaultValue: formatValue(definition.defaultValue),
    ...(definition.kind === 'experiment'
      ? { variants: definition.variants }
      : {}),
  }
}

function tierOf(value: unknown): Tier | undefined {
  return value === 'free' || value === 'premium' ? value : undefined
}

async function inspectLimit(
  flags: FeatureFlags,
  key: LimitKey,
  context: EvaluationContext,
): Promise<FlagInspection> {
  const definition = describeLimit(key)
  const anyTier = tierOf(context.tier) ?? 'free'
  // Enforcement uses the scope-resolved tier, never the best-of tier.
  const enforced = tierOf((context as { tierEnforced?: unknown }).tierEnforced)
  const tier = enforced ?? anyTier
  const fallback = getLimit(key, tier)
  const details = await flags.limitDetails(limitFlagKey(key), fallback, context)
  return {
    key: limitFlagKey(key),
    kind: 'limit',
    owner: 'premium',
    description: `${definition.description} (${definition.scope} scope, evaluated at tier ${tier}${enforced && enforced !== anyTier ? `, any ${anyTier}` : ''})`,
    value: formatValue(details.value),
    ...evaluationFields(details),
    expired: false,
    defaultValue: formatValue(fallback),
  }
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
  if (value === Number.POSITIVE_INFINITY) return 'unlimited'
  if (value === '') return '(empty)'
  return String(value)
}

function isExpired(expiresAt: string | undefined, now = new Date()): boolean {
  return expiresAt !== undefined && Date.parse(expiresAt) <= now.getTime()
}

/** Chunked for Discord; expired flags pin to the top. */
export function formatFlagList(
  inspections: readonly FlagInspection[],
): string[] {
  const expired = inspections.filter((inspection) => inspection.expired)
  const live = inspections.filter((inspection) => !inspection.expired)
  const lines: string[] = []
  if (expired.length > 0) {
    lines.push(`⚠️ ${expired.length} flag(s) past expiry:`)
    lines.push(...expired.map(flagLine))
    lines.push('')
  }
  lines.push(...live.map(flagLine))
  return chunkLines(lines, 1_900)
}

export function formatFlagDetail(inspection: FlagInspection): string {
  const lines = [
    `\`${inspection.key}\` (${inspection.kind}, owner: ${inspection.owner})`,
    inspection.description,
    `value: **${inspection.value}** (${inspection.source})`,
    `default: ${inspection.defaultValue}`,
  ]
  if (inspection.variants)
    lines.push(`variants: ${inspection.variants.join(', ')}`)
  if (inspection.expiresAt)
    lines.push(
      `${inspection.expired ? '⚠️ expired' : 'expires'}: ${inspection.expiresAt}`,
    )
  if (inspection.errorMessage) lines.push(`error: ${inspection.errorMessage}`)
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
