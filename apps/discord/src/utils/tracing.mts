import type { Listener } from '@sapphire/framework'
import {
  type Attributes,
  resolveShardId,
  SpanStatusCode,
  trace,
} from '@thesharks/analytics'
import type { Interaction } from 'discord.js'

export type DiscordScope = 'guild' | 'dm'

export interface DiscordSpanAttributes extends Attributes {
  shard_id?: string
  scope?: DiscordScope
  guild_id?: string
  'discord.interaction.id'?: string
  'discord.interaction.type'?: string
  'discord.command.name'?: string
  'discord.listener.event'?: string
  'discord.listener.name'?: string
  'discord.task.name'?: string
}

export function getTracer() {
  return trace.getTracer('@thesharks/discord')
}

export function spanName(name: string): string {
  return `discord.${name}`
}

export function resolveInteractionScope(
  interaction: Interaction,
): DiscordScope {
  return interaction.inGuild() ? 'guild' : 'dm'
}

export function attributesFromInteraction(
  interaction: Interaction,
  listener?: Listener,
): DiscordSpanAttributes {
  const attributes: DiscordSpanAttributes = {
    shard_id: resolveShardId(interaction, listener),
    scope: resolveInteractionScope(interaction),
    'discord.interaction.id': interaction.id,
    'discord.interaction.type': String(interaction.type),
  }

  if (interaction.inGuild()) {
    attributes.guild_id = interaction.guildId ?? undefined
  }

  return attributes
}

export function updateActiveSpan(updates: {
  attributes?: Attributes
  status?: SpanStatusCode
  event?: { name: string; attributes?: Attributes }
  error?: unknown
}): boolean {
  const span = trace.getActiveSpan()
  if (!span) {
    return false
  }

  if (updates.attributes) {
    span.setAttributes(updates.attributes)
  }

  if (updates.event) {
    span.addEvent(updates.event.name, updates.event.attributes)
  }

  if (updates.error) {
    span.recordException(updates.error as Error)
    span.setStatus({ code: SpanStatusCode.ERROR })
  } else if (updates.status !== undefined) {
    span.setStatus({ code: updates.status })
  }

  return true
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T> | T,
): Promise<T> {
  const tracer = getTracer()

  return tracer.startActiveSpan(
    name,
    {
      attributes,
    },
    async (span) => {
      try {
        return await fn()
      } catch (error) {
        span.recordException(error as Error)
        span.setStatus({ code: SpanStatusCode.ERROR })
        throw error
      } finally {
        span.end()
      }
    },
  )
}
