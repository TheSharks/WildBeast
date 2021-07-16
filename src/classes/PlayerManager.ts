import { Player, Node } from '@thesharks/tyr'
import client from '../components/client'
import { info, warn, error, debug } from '../components/logger'
import { PlayerEvent, PlayerUpdate } from '@lavaclient/types'
import { GatewayClientEvents, ShardClient } from 'detritus-client'

declare interface NodeConstructor {
  host: string
  port: number | string
  password: string
}

declare interface PendingConnection {
  channelID: string
  res: Function
  rej: Function
  timeout: NodeJS.Timeout | null
}

export class PlayerManager extends Map<string, Player> {
  nodes: Node[] = []
  pending: Map<string, PendingConnection> = new Map()

  connect (nodes: NodeConstructor[], destroy: boolean = false): void {
    if (destroy) {
      info('Destoying connections to all current Lavalink nodes', 'PlayerManager')
      if (this.nodes.length > 0) this.nodes.forEach(x => x.destroy())
      this.nodes = []
    }
    const nodeAdresses = this.nodes.map(x => x.address)
    const newnodes = nodes.filter(x => !nodeAdresses.includes(`${x.host}:${x.port}`))
    debug(`Connecting to ${newnodes.length} new nodes`, 'PlayerManager')
    this.nodes = newnodes.map(x => {
      debug(`Constructing a node with address ${x.host}:${x.port}`, 'PlayerManager')
      return new Node({
        shards: client.shardCount,
        user: client.shards.first()!.userId,
        ...x
      })
    })
    this.nodes
      .filter(x => x.listenerCount('message') === 0) // might duplicate ready and other verbose loggers, but we mainly care about not interpreting messages many times
      .forEach(x => {
        x.on('message', this.onNodeMessage.bind(this))
        x.on('ready', () => info('Node reported ready', `Lavalink node ${x.address}`))
        x.on('disconnected', () => warn('Node disconnected!', `Lavalink node ${x.address}`))
        x.on('error', e => error(e, `Lavalink node ${x.address}`))
      })
    if (this.nodes.length === 0) warn('Called connect, but got no nodes! Music related commands will not work', 'PlayerManager')
  }

  async join (guildID: string, channelID: string, shard: ShardClient): Promise<Player> {
    debug(`Instatiating a new player for guild ${guildID} and channel ${channelID}`, 'PlayerManager')
    const player = this.get(guildID)
    if ((player?.connected) === true) {
      player.switchChannel(channelID)
      return player
    }
    shard.gateway.voiceStateUpdate(guildID, channelID, {
      selfDeaf: true
    })
    return await new Promise((resolve, reject) => {
      this.pending.set(guildID, {
        channelID: channelID,
        res: resolve,
        rej: reject,
        timeout: setTimeout(() => {
          this.pending.delete(guildID)
          reject(new Error('Voice connection timeout'))
        }, 10000)
      })
    })
  }

  // we guarantee guildId since detritus has support for running as a user that can take DM calls, wildbeast will always assume its running a bot account
  voiceServerUpdate (data: GatewayClientEvents.ClusterEvent & GatewayClientEvents.VoiceServerUpdate): void {
    if (data.endpoint === null) {
      return debug('Got a voiceServerUpdate with a null endpoint, discarding')
    }
    const pending = this.pending.get(data.guildId!)
    if (pending !== undefined) {
      clearTimeout(pending.timeout as NodeJS.Timeout)
      pending.timeout = null
    }
    let player = this.get(data.guildId!)
    if (player === undefined) {
      if (pending === undefined) {
        warn(`Got a voiceServerUpdate for a player we didn't instantiate? Guild ID ${data.guildId!}`, 'PlayerManager')
        return
      }
      debug(`Got a voiceServerUpdate, creating a new player for guild ID ${data.guildId!}`, 'PlayerManager')
      player = new Player(this.selectBestLavalinkNode(), data.guildId!, (op, ctx) => data.shard.gateway.send(op, ctx))
      this.set(data.guildId!, player)
    }
    player.once('ready', () => {
      player?.removeAllListeners('disconnected')
      debug(`The player for guild ${data.guildId!} has reported it's ready`, 'Lavalink')
      pending?.res(player)
      this.pending.delete(data.guildId!)
    })
    player.once('disconnected', ctx => {
      debug(`The player for guild ${data.guildId!} disconnected prematurely! ${ctx.reason}`, 'Lavalink')
      pending?.rej(new Error(ctx.reason))
      this.pending.delete(data.guildId!)
      this.delete(data.guildId!)
    })
    player.on('warn', (x) => warn(x, 'Lavalink'))
    const sessionID = data.shard.voiceStates.get(data.guildId!)?.get(client.shards.first()!.userId)?.sessionId
    if (sessionID === undefined) {
      error(`Got a voiceServerUpdate for guild ${data.guildId!}, but this shard is unaware of the voice state!`, 'PlayerManager')
      this.delete(data.guildId!)
    } else {
      player.connect({
        sessionId: sessionID,
        event: {
          token: data.token,
          guild_id: data.guildId,
          endpoint: data.endpoint
        }
      })
    }
  }

  leave (guildID: string): void {
    debug(`Destroying player for guild ${guildID}`)
    const player = this.get(guildID)
    if (player == null) return
    player.disconnect()
    this.delete(guildID)
  }

  private selectBestLavalinkNode (): Node {
    const availableNodes = this.nodes.filter(x => x.connected).sort((a, b) => {
      const aload = ((a.stats?.cpu) != null) ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100 : 0
      const bload = ((b.stats?.cpu) != null) ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100 : 0
      return aload - bload
    })
    if (availableNodes.length === 0) throw new Error('No lavalink nodes connected that are able to handle connections')
    debug(`Determined that node ${availableNodes[0].address} is probably the least busy, assinging new player to this node`, 'PlayerManager')
    return availableNodes[0]
  }

  private onNodeMessage (msg: PlayerEvent | PlayerUpdate): void {
    // trace(msg, 'Lavalink message')
    const player = this.get(msg.guildId)
    if (player == null) return
    player.onNodeMessage(msg)
  }
}
