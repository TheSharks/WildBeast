import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { SubcommandPluginEvents } from '@sapphire/plugin-subcommands'
import { metrics } from '@thesharks/analytics'
import type { ClientEvents, CommandInteraction } from 'discord.js'
import { sendErrorReport } from '../../telemetry/error-reply.mjs'
import {
  attributesFromInteraction,
  captureInteractionError,
  commandMetricLabels,
  withErrorSpan,
} from '../../telemetry/spans.mjs'

const meter = metrics.getMeter('@thesharks/discord')
// Labels frozen by METRIC_CONTRACT['discord_command_errors_total'].
const errorCounter = meter.createCounter('discord_command_errors_total', {
  description: 'Total number of Discord command errors',
})
// Labels frozen by METRIC_CONTRACT['discord_context_command_errors_total'].
const contextErrorCounter = meter.createCounter(
  'discord_context_command_errors_total',
  { description: 'Total number of Discord context menu command errors' },
)

/** Metric, Sentry capture and a correlated user reply, in one place. */
async function report(
  listener: Listener,
  interaction: CommandInteraction,
  command: string,
  error: unknown,
  subcommand?: string,
) {
  const counter = interaction.isContextMenuCommand()
    ? contextErrorCounter
    : errorCounter
  counter.add(
    1,
    commandMetricLabels(interaction, command, listener, {
      ...(subcommand ? { subcommand } : {}),
    }),
  )
  return withErrorSpan(
    'discord.command.error_reporting',
    interaction,
    {
      ...attributesFromInteraction(interaction, listener),
      'discord.command.name': command,
      ...(subcommand ? { 'discord.command.subcommand': subcommand } : {}),
    },
    async () => {
      const uuid = captureInteractionError(
        interaction,
        error,
        subcommand ? { subcommand } : {},
      )
      listener.container.logger.error(`Command failed [${uuid}]:`, error)
      await sendErrorReport(interaction, uuid)
    },
  )
}

@ApplyOptions<ListenerOptions>({
  name: 'chatInputCommandError',
  event: Events.ChatInputCommandError,
})
export class ChatInputCommandErrorListener extends Listener {
  public run(...[error, payload]: ClientEvents['chatInputCommandError']) {
    return report(this, payload.interaction, payload.command.name, error)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'contextMenuCommandError',
  event: Events.ContextMenuCommandError,
})
export class ContextMenuCommandErrorListener extends Listener {
  public run(...[error, payload]: ClientEvents['contextMenuCommandError']) {
    return report(this, payload.interaction, payload.command.name, error)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'chatInputSubcommandError',
  event: SubcommandPluginEvents.ChatInputSubcommandError,
})
export class ChatInputSubcommandErrorListener extends Listener {
  public run(...[error, payload]: ClientEvents['chatInputSubcommandError']) {
    this.container.app.experiments.complete('error')
    return report(
      this,
      payload.interaction,
      payload.command.name,
      error,
      payload.matchedSubcommandMapping?.name ?? 'unknown',
    )
  }
}
