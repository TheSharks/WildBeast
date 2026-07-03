import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'

const meter = metrics.getMeter('@thesharks/discord')
const gatewayEventCounter = meter.createCounter(
  'discord_gateway_events_total',
  {
    description: 'Gateway packets received, by dispatch type and shard',
  },
)

@ApplyOptions<ListenerOptions>({
  event: Events.Raw,
})
export class GatewayEventMetricsListener extends Listener {
  public run(...[packet, shardId]: ClientEvents['raw']): void {
    // Dispatch packets carry the event name in `t`; other opcodes (heartbeat,
    // hello, ...) are labelled by opcode. Both are small bounded sets.
    const data = packet as { t?: unknown; op?: unknown }
    const type =
      typeof data?.t === 'string'
        ? data.t
        : `op_${typeof data?.op === 'number' ? data.op : 'unknown'}`

    gatewayEventCounter.add(1, {
      type,
      shard_id: String(shardId),
    })
  }
}
