import type { ChatInputCommandErrorPayload } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { type Attributes, metrics, resolveShardId } from '@thesharks/analytics'

const meter = metrics.getMeter('@thesharks/discord')
const errorCounter = meter.createCounter('discord_command_errors_total', {
  description: 'Total number of Discord command errors',
})

function resolveScope(payload: ChatInputCommandErrorPayload): 'guild' | 'dm' {
  return payload.interaction.inGuild() ? 'guild' : 'dm'
}

function createLabels(
  payload: ChatInputCommandErrorPayload,
  shardId: string,
): Attributes {
  return {
    command: payload.command?.name,
    shard_id: shardId,
    scope: resolveScope(payload),
  }
}

export class CommandErrorListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'chatInputCommandError',
    })
  }

  public run(payload: ChatInputCommandErrorPayload) {
    const shardId = resolveShardId(payload.interaction, this)
    const labels = createLabels(payload, shardId)
    errorCounter.add(1, labels)
  }
}
