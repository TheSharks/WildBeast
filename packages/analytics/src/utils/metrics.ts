import { type Attributes, metrics } from '@opentelemetry/api'
import type { Listener } from '@sapphire/framework'
import type { Guild } from 'discord.js'

export type {
  Context as OTelContext,
  Link as OTelLink,
  SpanContext as OTelSpanContext,
} from '@opentelemetry/api'
// Shared meter/name/type dedupes instruments across listener files.
export { context } from '@opentelemetry/api'

type AttributeValue = Attributes[keyof Attributes]

/** Second-scale buckets; SDK defaults collapse sub-5s measurements. */
export const DURATION_SECONDS_BOUNDARIES = [
  0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60,
]

/** Shard id from interaction guild, else piece container. */
export function resolveShardId(
  interaction?: { guild?: Guild | null },
  piece?: Pick<Listener, 'container'>,
): string {
  // Interaction guild is per-interaction accurate.
  if (interaction?.guild?.shardId !== undefined) {
    return interaction.guild.shardId.toString()
  }

  // Fall back to piece container shard.
  if (piece) {
    const shardId = piece.container.client.shard?.ids?.[0]
    if (typeof shardId === 'number') {
      return shardId.toString()
    }
  }

  return 'unknown'
}

function formatAttributeValue(value: AttributeValue): string {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(',')
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${key}:${String(entryValue)}`)
    return `{${entries.join(',')}}`
  }

  return String(value)
}

function buildAttributeKey(attributes: Attributes) {
  return Object.keys(attributes)
    .sort()
    .map((key) => `${key}:${formatAttributeValue(attributes[key])}`)
    .join('|')
}

/**
 * Observable gauge with set/clear/reset; prefer set(0) over clear for dashboards (cumulative readers retain last value).
 */
export function createGauge(
  meterName: string,
  name: string,
  description: string,
  unit?: string,
) {
  const values = new Map<string, { value: number; attributes: Attributes }>()
  const meter = metrics.getMeter(meterName)
  const instrument = meter.createObservableGauge(name, { description, unit })

  instrument.addCallback((result) => {
    values.forEach((entry) => {
      result.observe(entry.value, entry.attributes)
    })
  })

  return {
    set(value: number, attributes: Attributes) {
      const key = buildAttributeKey(attributes)
      values.set(key, { value, attributes })
    },
    clear(attributes: Attributes) {
      const key = buildAttributeKey(attributes)
      values.delete(key)
    },
    reset() {
      values.clear()
    },
  }
}
