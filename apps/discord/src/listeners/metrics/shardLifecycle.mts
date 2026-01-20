import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { type Attributes, metrics, SpanStatusCode } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'
import { spanName, withSpan } from '../../utils/tracing.mjs'

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

@ApplyOptions<ListenerOptions>({
  event: Events.ShardReady,
})
export class ShardReadyListener extends Listener {
  public run(...[shardId]: ClientEvents['shardReady']): void {
    void withSpan(
      spanName('listener'),
      {
        'discord.listener.name': this.name,
        'discord.listener.event': Events.ShardReady,
      },
      () => {
        shardReadyCounter.add(1, {
          shard_id: String(shardId),
        })
      },
    )
  }
}

@ApplyOptions<ListenerOptions>({
  event: Events.ShardDisconnect,
})
export class ShardDisconnectListener extends Listener {
  public run(...[closeEvent, shardId]: ClientEvents['shardDisconnect']): void {
    void withSpan(
      spanName('listener'),
      {
        'discord.listener.name': this.name,
        'discord.listener.event': Events.ShardDisconnect,
        'discord.shard.close_code': String(closeEvent.code),
      },
      () => {
        shardDisconnectCounter.add(1, {
          shard_id: String(shardId),
          close_code: String(closeEvent.code),
          clean: String(closeEvent.wasClean),
        })
      },
    )
  }
}

@ApplyOptions<ListenerOptions>({
  event: Events.ShardReconnecting,
})
export class ShardReconnectingListener extends Listener {
  public run(...[shardId]: ClientEvents['shardReconnecting']): void {
    void withSpan(
      spanName('listener'),
      {
        'discord.listener.name': this.name,
        'discord.listener.event': Events.ShardReconnecting,
      },
      () => {
        shardReconnectCounter.add(1, {
          shard_id: String(shardId),
        })
      },
    )
  }
}

@ApplyOptions<ListenerOptions>({
  event: Events.ShardResume,
})
export class ShardResumeListener extends Listener {
  public run(...[shardId, replayed]: ClientEvents['shardResume']): void {
    void withSpan(
      spanName('listener'),
      {
        'discord.listener.name': this.name,
        'discord.listener.event': Events.ShardResume,
      },
      () => {
        shardResumeCounter.add(1, {
          shard_id: String(shardId),
          replayed: String(replayed),
        })
      },
    )
  }
}
