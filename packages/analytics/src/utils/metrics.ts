import { type Attributes, metrics } from '@opentelemetry/api'
import type { Listener } from '@sapphire/framework'
import type { Guild } from 'discord.js'

type AttributeValue = Attributes[keyof Attributes]

/**
 * Resolve shard ID from interaction guild (preferred) or listener container
 */
export function resolveShardId(
  interaction?: { guild?: Guild | null },
  listener?: Listener,
): string {
  // Prefer interaction guild shard ID (most accurate per-interaction)
  if (interaction?.guild?.shardId !== undefined) {
    return interaction.guild.shardId.toString()
  }

  // Fall back to listener container client shard
  if (listener) {
    const shardId = listener.container.client.shard?.ids?.[0]
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
