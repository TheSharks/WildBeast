import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions, UserError } from '@sapphire/framework'
import { Events, Identifiers, Listener } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import { metrics } from '@thesharks/analytics'
import {
  type ActionRowBuilder,
  type ButtonBuilder,
  type ChatInputCommandInteraction,
  type ClientEvents,
  type ContextMenuCommandInteraction,
  MessageFlags,
} from 'discord.js'
import { denialReason } from '../../features/gates.mjs'
import { FeaturePreconditionIdentifier } from '../../preconditions/Feature.mjs'
import { OwnerOnlyPreconditionIdentifier } from '../../preconditions/OwnerOnly.mjs'
import { PremiumPreconditionIdentifier } from '../../preconditions/Premium.mjs'
import type { Scope, Tier } from '../../premium/model.mjs'
import { premiumUpsellComponents } from '../../premium/upsell.mjs'
import type { AppServices } from '../../runtime/services.mjs'
import { commandMetricLabels } from '../../telemetry/spans.mjs'

const meter = metrics.getMeter('@thesharks/discord')
// Labels frozen by METRIC_CONTRACT['discord_command_denied_total'].
const deniedCounter = meter.createCounter('discord_command_denied_total', {
  description:
    'Commands blocked by preconditions (permissions, cooldowns, ...)',
})

type DeniedInteraction =
  | ChatInputCommandInteraction
  | ContextMenuCommandInteraction

interface DenialReply {
  content: string
  components?: ActionRowBuilder<ButtonBuilder>[]
}

/** Scope-aware denial detail: who needs the subscription, and at which scope. */
export function premiumDenialDetail(
  interaction: Pick<DeniedInteraction, 'guildId'>,
  tier: string,
  scope: Scope | 'any',
): string {
  if (scope === 'guild') {
    if (!interaction.guildId)
      return `This command needs ${tier} for a server and can't be used in DMs (guild scope).`
    return `This server needs ${tier} (guild scope) to use this command.`
  }
  if (scope === 'user')
    return `You need ${tier} (user scope) to use this command.`
  if (!interaction.guildId) return `You need ${tier} to use this command.`
  return `You or this server need ${tier} to use this command.`
}

export async function describeDenial(
  app: Pick<AppServices, 'config'>,
  interaction: DeniedInteraction,
  error: UserError,
): Promise<DenialReply> {
  const context = Object(error.context)
  if (error.identifier === Identifiers.PreconditionCooldown) {
    const remaining = Number(Reflect.get(context, 'remaining') ?? 0)
    return {
      content: (await resolveKey(interaction, 'system/errors:cooldown', {
        resumeAt: `<t:${Math.ceil((Date.now() + remaining) / 1000)}:R>`,
      })) as string,
    }
  }
  const reason = denialReason({
    flagEnabled: error.identifier !== FeaturePreconditionIdentifier,
    premiumAllowed: error.identifier !== PremiumPreconditionIdentifier,
  })
  if (reason === 'feature') {
    return {
      content: (await resolveKey(
        interaction,
        'system/errors:feature_unavailable',
      )) as string,
    }
  }
  if (error.identifier === OwnerOnlyPreconditionIdentifier) {
    return {
      content: (await resolveKey(
        interaction,
        'system/errors:owner_only',
      )) as string,
    }
  }
  if (reason === 'premium') {
    const tier: Tier =
      Reflect.get(context, 'requiredTier') === 'free' ? 'free' : 'premium'
    const rawScope = Reflect.get(context, 'requiredScope')
    const scope = rawScope === 'user' || rawScope === 'guild' ? rawScope : 'any'
    const base = (await resolveKey(
      interaction,
      'system/errors:premium_required',
      { tier, scope },
    )) as string
    return {
      content: `${base} ${premiumDenialDetail(interaction, tier, scope)}`,
      components: premiumUpsellComponents(
        app.config.premiumCatalog,
        tier,
        scope,
        interaction.guildId ? BigInt(interaction.guildId) : null,
      ),
    }
  }
  // Other precondition messages are framework English until they gain keys.
  return { content: error.message }
}

async function handle(
  listener: Listener,
  error: UserError,
  interaction: DeniedInteraction,
  command: string,
) {
  deniedCounter.add(
    1,
    commandMetricLabels(interaction, command, listener, {
      identifier: error.identifier,
    }),
  )
  listener.container.logger.debug(
    `Command ${command} denied: ${error.identifier}`,
  )
  // Preconditions can opt out of user feedback.
  if (Reflect.get(Object(error.context), 'silent')) return
  const reply = await describeDenial(listener.container.app, interaction, error)
  if (interaction.replied || interaction.deferred)
    return interaction.editReply(reply)
  return interaction.reply({ ...reply, flags: MessageFlags.Ephemeral })
}

@ApplyOptions<ListenerOptions>({
  name: 'chatInputCommandDenied',
  event: Events.ChatInputCommandDenied,
})
export class ChatInputCommandDeniedListener extends Listener {
  public run(...[error, payload]: ClientEvents['chatInputCommandDenied']) {
    return handle(this, error, payload.interaction, payload.command.name)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'contextMenuCommandDenied',
  event: Events.ContextMenuCommandDenied,
})
export class ContextMenuCommandDeniedListener extends Listener {
  public run(...[error, payload]: ClientEvents['contextMenuCommandDenied']) {
    return handle(this, error, payload.interaction, payload.command.name)
  }
}
