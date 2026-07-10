import type { Listener } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import {
  type Attributes,
  resolveShardId,
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

/** Canonical low-cardinality labels shared by command metrics listeners. */
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

/**
 * Populate a Sentry scope with everything we know about a command
 * interaction. Always use a local or isolation scope for this: the shared
 * global scope leaks user data between concurrently running interactions.
 */
export function applyInteractionScope(
  scope: Sentry.Scope,
  interaction: CommandInteraction,
): void {
  scope.setUser({
    id: interaction.user.id,
    username: interaction.user.tag,
  })
  scope.setTag('command', interaction.commandName)
  scope.setContext('interaction', {
    id: interaction.id,
    type: interaction.type,
    commandName: interaction.commandName,
  })
  if (interaction.inGuild()) {
    scope.setContext('guild', {
      id: interaction.guildId,
      name: interaction.guild?.name,
    })
    scope.setContext('channel', {
      id: interaction.channelId,
      name: interaction.channel?.name,
      type: interaction.channel?.type,
    })
  } else {
    scope.setContext('dm', {
      channelId: interaction.channelId,
    })
  }
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

/**
 * Run `fn` inside a fresh Sentry isolation scope (so breadcrumbs, user and
 * tags don't bleed between concurrent interactions) and an active span (so
 * database/HTTP child spans nest under it).
 */
export async function withInteractionSpan<T>(
  name: string,
  interaction: CommandInteraction,
  attributes: Attributes,
  fn: () => Promise<T> | T,
): Promise<T> {
  return Sentry.withIsolationScope((scope) => {
    applyInteractionScope(scope, interaction)
    return withSpan(name, attributes, fn)
  })
}

/** Capture and report a command failure with one consistent scope and
 * breadcrumb shape across chat-input, context-menu, and subcommand events. */
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
