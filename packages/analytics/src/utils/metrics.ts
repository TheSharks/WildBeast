import { type Attributes, metrics } from '@opentelemetry/api'
import type { Listener } from '@sapphire/framework'
import type { Guild } from 'discord.js'

type AttributeValue = Attributes[keyof Attributes]

/**
 * Bucket boundaries for histograms recorded in seconds. The SDK's default
 * boundaries (5, 10, 25, ...) are scaled for milliseconds and would collapse
 * every sub-5-second measurement into the first bucket.
 */
export const DURATION_SECONDS_BOUNDARIES = [
  0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60,
]

/**
 * Resolve shard ID from interaction guild (preferred) or the container of any
 * piece (listener, command, task, ...)
 */
export function resolveShardId(
  interaction?: { guild?: Guild | null },
  piece?: Pick<Listener, 'container'>,
): string {
  // Prefer interaction guild shard ID (most accurate per-interaction)
  if (interaction?.guild?.shardId !== undefined) {
    return interaction.guild.shardId.toString()
  }

  // Fall back to the piece's container client shard
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
 * Create an observable gauge with set/clear/reset methods
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
