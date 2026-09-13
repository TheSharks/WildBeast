import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'

const meter = metrics.getMeter('@thesharks/discord')
const shardReadyCounter = meter.createCounter('discord_shard_ready_total', {
  description: 'Total number of times a shard became ready',
})
const shardDisconnectCounter = meter.createCounter(
  'discord_shard_disconnect_total',
  {
    description: 'Total number of shard disconnects',
  },
)
const shardReconnectCounter = meter.createCounter(
  'discord_shard_reconnect_total',
  {
    description: 'Total number of shard reconnections',
  },
)
const shardResumeCounter = meter.createCounter('discord_shard_resume_total', {
  description: 'Total number of times a shard resumed',
})

// Explicit names prevent same-file listeners unloading each other.
@ApplyOptions<ListenerOptions>({
  name: 'shardReadyMetrics',
  event: Events.ShardReady,
})
export class ShardReadyListener extends Listener {
  public run(...[shardId]: ClientEvents['shardReady']): void {
    shardReadyCounter.add(1, {
      shard_id: String(shardId),
    })
    this.container.logger.info(`Shard ${shardId} is ready.`)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'shardDisconnectMetrics',
  event: Events.ShardDisconnect,
})
export class ShardDisconnectListener extends Listener {
  public run(...[closeEvent, shardId]: ClientEvents['shardDisconnect']): void {
    shardDisconnectCounter.add(1, {
      shard_id: String(shardId),
      close_code: String(closeEvent.code),
      clean: String(closeEvent.wasClean),
    })
    this.container.logger.warn(
      `Shard ${shardId} disconnected (code ${closeEvent.code}, clean: ${closeEvent.wasClean}).`,
    )
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'shardReconnectingMetrics',
  event: Events.ShardReconnecting,
})
export class ShardReconnectingListener extends Listener {
  public run(...[shardId]: ClientEvents['shardReconnecting']): void {
    shardReconnectCounter.add(1, {
      shard_id: String(shardId),
    })
    this.container.logger.info(`Shard ${shardId} is reconnecting.`)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'shardResumeMetrics',
  event: Events.ShardResume,
})
export class ShardResumeListener extends Listener {
  public run(...[shardId, replayed]: ClientEvents['shardResume']): void {
    shardResumeCounter.add(1, {
      shard_id: String(shardId),
    })
    this.container.logger.info(
      `Shard ${shardId} resumed (${replayed} events replayed).`,
    )
  }
}
