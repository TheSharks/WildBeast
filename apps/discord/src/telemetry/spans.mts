import type { Listener } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import {
  type Attributes,
  context,
  type OTelLink,
  type OTelSpanContext,
  resolveShardId,
  type Span,
  SpanStatusCode,
  trace,
} from '@thesharks/analytics'
import type { CommandInteraction, Guild, Interaction } from 'discord.js'

export type DiscordScope = 'guild' | 'dm'

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

/** Low-cardinality labels for command metrics. */
export function commandMetricLabels(
  interaction: { guild?: Guild | null; inGuild(): boolean },
  command: string | undefined,
  piece?: Pick<Listener, 'container'>,
  extra: Attributes = {},
): Attributes {
  return {
    command,
    shard_id: resolveShardId(interaction, piece),
    scope: interaction.inGuild() ? 'guild' : 'dm',
    ...extra,
  }
}

export function interactionDurationSeconds(
  interaction: Pick<Interaction, 'createdTimestamp'>,
): number {
  return Math.max(0, Date.now() - interaction.createdTimestamp) / 1_000
}

export interface InteractionLike {
  id: string
  type: number
  guildId: string | null
  guild?: Guild | null
  inGuild(): boolean
}

export function attributesFromInteraction(
  interaction: InteractionLike,
  piece?: Pick<Listener, 'container'>,
): Attributes {
  return {
    shard_id: resolveShardId(interaction, piece),
    scope: interaction.inGuild() ? 'guild' : 'dm',
    'discord.interaction.id': interaction.id,
    'discord.interaction.type': String(interaction.type),
    ...(interaction.guildId ? { guild_id: interaction.guildId } : {}),
  }
}

/** Id-only Sentry scope unless SENTRY_INCLUDE_PII opts in. */
export function applyInteractionScope(
  scope: Sentry.Scope,
  interaction: CommandInteraction,
  includePII = process.env.SENTRY_INCLUDE_PII === 'true',
): void {
  scope.setUser(
    includePII
      ? { id: interaction.user.id, username: interaction.user.tag }
      : { id: interaction.user.id },
  )
  scope.setTag('command', interaction.commandName)
  scope.setContext('interaction', {
    id: interaction.id,
    type: interaction.type,
    commandName: interaction.commandName,
  })
  if (interaction.inGuild()) {
    scope.setContext(
      'guild',
      includePII
        ? { id: interaction.guildId, name: interaction.guild?.name }
        : { id: interaction.guildId },
    )
    scope.setContext(
      'channel',
      includePII
        ? {
            id: interaction.channelId,
            name: interaction.channel?.name,
            type: interaction.channel?.type,
          }
        : { id: interaction.channelId, type: interaction.channel?.type },
    )
  } else {
    scope.setContext('dm', { channelId: interaction.channelId })
  }
}

/** Ended command spans, remembered so error reporting can link to them. */
const interactionTraces = new Map<string, OTelSpanContext>()

function rememberInteractionTrace(interactionId: string): void {
  const active = trace.getSpan(context.active())?.spanContext()
  if (!active?.traceId) return
  if (interactionTraces.size > 1000) {
    const oldest = interactionTraces.keys().next()
    if (!oldest.done) interactionTraces.delete(oldest.value)
  }
  interactionTraces.set(interactionId, active)
}

function linksForInteraction(interactionId: string): OTelLink[] {
  const stored = interactionTraces.get(interactionId)
  if (!stored) return []
  interactionTraces.delete(interactionId)
  return [{ context: stored }]
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T> | T,
): Promise<T> {
  const op =
    typeof attributes['sentry.op'] === 'string'
      ? attributes['sentry.op']
      : 'discord'
  return Sentry.startSpan({ name, op, attributes }, async (sentrySpan) => {
    const run = async (span: Span | undefined, end: boolean): Promise<T> => {
      try {
        return await fn()
      } catch (error) {
        try {
          span?.recordException(error as Error)
          span?.setStatus({ code: SpanStatusCode.ERROR })
          sentrySpan.recordException(error)
        } catch {
          // Never mask the original error.
        }
        throw error
      } finally {
        if (end) span?.end()
      }
    }
    const active = trace.getActiveSpan()
    if (active) return run(active, false)
    return getTracer().startActiveSpan(name, { attributes }, (span) =>
      run(span, true),
    )
  })
}

/** Run inside an isolation scope and active span so children nest correctly. */
export async function withInteractionSpan<T>(
  name: string,
  interaction: CommandInteraction,
  attributes: Attributes,
  fn: () => Promise<T> | T,
): Promise<T> {
  return Sentry.withIsolationScope((scope) => {
    applyInteractionScope(scope, interaction)
    return withSpan(name, attributes, async () => {
      rememberInteractionTrace(interaction.id)
      return fn()
    })
  })
}

/** Error span linked to the ended command span rather than parented by it. */
export async function withErrorSpan<T>(
  name: string,
  interaction: CommandInteraction,
  attributes: Attributes,
  fn: () => Promise<T> | T,
): Promise<T> {
  const links = linksForInteraction(interaction.id)
  const op =
    typeof attributes['sentry.op'] === 'string'
      ? attributes['sentry.op']
      : 'discord.error_reporting'
  return Sentry.startSpan({ name, op, attributes }, async (sentrySpan) =>
    getTracer().startActiveSpan(
      name,
      { attributes, links },
      async (span: Span) => {
        try {
          return await fn()
        } catch (error) {
          span.recordException(error as Error)
          span.setStatus({ code: SpanStatusCode.ERROR })
          try {
            sentrySpan.recordException(error)
          } catch {
            // ignore
          }
          throw error
        } finally {
          span.end()
        }
      },
    ),
  )
}

export function captureInteractionError(
  interaction: CommandInteraction,
  error: unknown,
  breadcrumbData: Record<string, unknown> = {},
): string {
  return Sentry.withScope((scope) => {
    applyInteractionScope(scope, interaction)
    scope.addBreadcrumb({
      category: 'command',
      level: 'error',
      message: error instanceof Error ? error.message : String(error),
      data: {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        ...breadcrumbData,
      },
    })
    return Sentry.captureException(error)
  })
}
