import type { Listener } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import {
  type Attributes,
  context,
  type OTelContext,
  type OTelLink,
  type OTelSpanContext,
  resolveShardId,
  type Span,
  SpanStatusCode,
  trace,
} from '@thesharks/analytics'
import type { CommandInteraction, Guild, Interaction } from 'discord.js'
import { sendErrorReport } from './errorResponse.mjs'

export type DiscordScope = 'guild' | 'dm'

export interface DiscordSpanAttributes extends Attributes {
  shard_id?: string
  scope?: DiscordScope
  guild_id?: string
  'discord.interaction.id'?: string
  'discord.interaction.type'?: string
  'discord.command.name'?: string
  'discord.command.type'?: string
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

export function attributesFromInteraction(
  interaction: Interaction,
  piece?: Pick<Listener, 'container'>,
): DiscordSpanAttributes {
  const attributes: DiscordSpanAttributes = {
    shard_id: resolveShardId(interaction, piece),
    scope: resolveInteractionScope(interaction),
    'discord.interaction.id': interaction.id,
    'discord.interaction.type': String(interaction.type),
  }

  if (interaction.inGuild()) {
    attributes.guild_id = interaction.guildId ?? undefined
  }

  return attributes
}

export interface InteractionScopeOptions {
  /** Opt-in to PII (user/guild/channel names); default id-only. */
  includePII?: boolean
}

function shouldIncludePII(options?: InteractionScopeOptions): boolean {
  if (options?.includePII !== undefined) return options.includePII
  return process.env.SENTRY_INCLUDE_PII === 'true'
}

/** Sentry scope for an interaction; use isolation scope to avoid cross-interaction leaks. Id-only unless includePII. */
export function applyInteractionScope(
  scope: Sentry.Scope,
  interaction: CommandInteraction,
  options?: InteractionScopeOptions,
): void {
  const includePII = shouldIncludePII(options)
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
        : {
            id: interaction.channelId,
            type: interaction.channel?.type,
          },
    )
  } else {
    scope.setContext('dm', {
      channelId: interaction.channelId,
    })
  }
}

/** Trace contexts by interaction id for linking error spans to ended command spans. */
const interactionTraceContexts = new Map<string, OTelSpanContext>()

function rememberInteractionTrace(interactionId: string): void {
  const active = trace.getSpan(context.active())?.spanContext()
  if (active?.traceId) {
    if (interactionTraceContexts.size > 1000) {
      const oldest = interactionTraceContexts.keys().next()
      if (!oldest.done) interactionTraceContexts.delete(oldest.value)
    }
    interactionTraceContexts.set(interactionId, active)
  }
}

function takeInteractionTrace(
  interactionId: string,
): OTelSpanContext | undefined {
  const stored = interactionTraceContexts.get(interactionId)
  if (stored) interactionTraceContexts.delete(interactionId)
  return stored
}

function linksForInteraction(interactionId: string): OTelLink[] {
  const stored = takeInteractionTrace(interactionId)
  return stored ? [{ context: stored }] : []
}

/** For tests: inspect or clear remembered trace links. */
export function __clearInteractionTraces(): void {
  interactionTraceContexts.clear()
}

export function __rememberInteractionTraceForTest(
  interactionId: string,
  spanContext: OTelSpanContext,
): void {
  interactionTraceContexts.set(interactionId, spanContext)
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T> | T,
  parentContext?: OTelContext,
): Promise<T> {
  const tracer = getTracer()
  const op =
    typeof attributes['sentry.op'] === 'string'
      ? (attributes['sentry.op'] as string)
      : undefined

  return Sentry.startSpan(
    {
      name,
      op: op ?? 'discord',
      attributes,
    },
    async (sentrySpan) => {
      const otelSpan = trace.getActiveSpan()
      const runWithOtel = async (): Promise<T> => {
        if (otelSpan) {
          try {
            return await fn()
          } catch (error) {
            try {
              otelSpan.recordException(error as Error)
              otelSpan.setStatus({ code: SpanStatusCode.ERROR })
            } catch {
              // Never mask original error.
            }
            throw error
          }
        }
        const runFallback = async (fallback: Span): Promise<T> => {
          try {
            return await fn()
          } catch (error) {
            fallback.recordException(error as Error)
            fallback.setStatus({ code: SpanStatusCode.ERROR })
            throw error
          } finally {
            fallback.end()
          }
        }
        if (parentContext) {
          return tracer.startActiveSpan(
            name,
            { attributes },
            parentContext,
            runFallback,
          )
        }
        return tracer.startActiveSpan(name, { attributes }, runFallback)
      }

      try {
        return await runWithOtel()
      } catch (error) {
        try {
          sentrySpan.recordException(error)
        } catch {
          // ignore
        }
        throw error
      }
    },
  )
}

/** Run fn in isolation scope + active span so children nest correctly. */
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

/** Error span linked to ended command span (link, not parent). */
export async function withErrorSpan<T>(
  name: string,
  interaction: CommandInteraction,
  attributes: Attributes,
  fn: () => Promise<T> | T,
): Promise<T> {
  const tracer = getTracer()
  const links = linksForInteraction(interaction.id)
  const op =
    typeof attributes['sentry.op'] === 'string'
      ? (attributes['sentry.op'] as string)
      : 'discord.error_reporting'

  return Sentry.startSpan({ name, op, attributes }, async (sentrySpan) => {
    try {
      return await tracer.startActiveSpan(
        name,
        { attributes, links },
        async (otelSpan: Span) => {
          try {
            return await fn()
          } catch (error) {
            otelSpan.recordException(error as Error)
            otelSpan.setStatus({ code: SpanStatusCode.ERROR })
            throw error
          } finally {
            otelSpan.end()
          }
        },
      )
    } catch (error) {
      try {
        sentrySpan.recordException(error)
      } catch {
        // ignore
      }
      throw error
    }
  })
}

/** Report command failure with consistent scope/breadcrumb shape. */
export async function captureInteractionError(
  interaction: CommandInteraction,
  error: unknown,
  breadcrumbData: Record<string, unknown> = {},
): Promise<void> {
  const uuid = Sentry.withScope((scope) => {
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
  await sendErrorReport(interaction, error, uuid)
}
