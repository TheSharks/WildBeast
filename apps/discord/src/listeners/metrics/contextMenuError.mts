import type { ContextMenuCommandErrorPayload } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { type Attributes, metrics, resolveShardId } from '@thesharks/analytics'

const meter = metrics.getMeter('@thesharks/discord')
const errorCounter = meter.createCounter(
  'discord_context_command_errors_total',
  {
    description: 'Total number of Discord context menu command errors',
  },
)

function resolveScope(payload: ContextMenuCommandErrorPayload): 'guild' | 'dm' {
  return payload.interaction.inGuild() ? 'guild' : 'dm'
}

function createLabels(
  payload: ContextMenuCommandErrorPayload,
  shardId: string,
): Attributes {
  return {
    command: payload.command?.name,
    shard_id: shardId,
    scope: resolveScope(payload),
  }
}

export class ContextMenuErrorListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'contextMenuCommandError',
    })
  }

  public run(payload: ContextMenuCommandErrorPayload) {
    const shardId = resolveShardId(payload.interaction, this)
    const labels = createLabels(payload, shardId)
    errorCounter.add(1, labels)
  }
}
