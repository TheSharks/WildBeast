import { setTimeout as sleep } from 'node:timers/promises'
import type { ILogger } from '@sapphire/framework'
import { createGauge, metrics } from '@thesharks/analytics'
import { shardsFor } from './assignment.mjs'
import type { ClusterCoordinator } from './coordination.mjs'

/**
 * The subset of shard lifecycle operations the reconciler needs; cluster.mts
 * adapts ShardingManager to this, tests use a fake.
 */
export interface ShardHost {
  currentShards(): number[]
  isAlive(shardId: number): boolean
  start(shardId: number): Promise<void>
  /** Graceful stop; resolves once the shard is dead. */
  stop(shardId: number): Promise<void>
}

export interface ReconcilerOptions {
  clusterId: string
  totalShards: number
  /** Reconcile interval. Default 5s. */
  tickMillis?: number
  /** How long membership must be stable before shards move. Default 10s. */
  settleMillis?: number
  /**
   * Stop serving shards when coordination has been unreachable this long.
   * Must be shorter than the lease TTL, so we stop before another cluster
   * can acquire our expired leases. Default 20s.
   */
  fenceAfterMillis?: number
}

export class ShardReconciler {
  private readonly tickMillis: number
  private readonly settleMillis: number
  private readonly fenceAfterMillis: number

  // Instruments are created at construction, not module scope: the OTEL
  // metrics API has no proxy provider (unlike traces), so instruments made
  // before initOpenTelemetry() are permanently bound to the no-op meter —
  // and this module is imported before telemetry initializes.
  private readonly handoffCounter
  private readonly coordinationErrorCounter
  private readonly memberGauge
  private readonly desiredShardGauge
  private readonly fencedGauge

  private running = false
  private loop?: Promise<void>
  private lastCoordinationSuccess = Date.now()
  private lastMembers: string[] = []
  private membersStableSince = 0
  private desired = new Set<number>()
  private fenced = false

  public constructor(
    private readonly coordinator: ClusterCoordinator,
    private readonly host: ShardHost,
    private readonly options: ReconcilerOptions,
    private readonly logger: ILogger,
  ) {
    this.tickMillis = options.tickMillis ?? 5_000
    this.settleMillis = options.settleMillis ?? 10_000
    this.fenceAfterMillis = options.fenceAfterMillis ?? 20_000

    const meter = metrics.getMeter('@thesharks/discord-manager')
    this.handoffCounter = meter.createCounter(
      'discord_cluster_shard_handoffs_total',
      {
        description: 'Shard ownership changes performed by this cluster',
      },
    )
    this.coordinationErrorCounter = meter.createCounter(
      'discord_cluster_coordination_errors_total',
      {
        description:
          'Failed coordination round trips (heartbeat/lease traffic)',
      },
    )
    this.memberGauge = createGauge(
      '@thesharks/discord-manager',
      'discord_cluster_members',
      'Live clusters in the fleet, as seen by this cluster',
    )
    this.desiredShardGauge = createGauge(
      '@thesharks/discord-manager',
      'discord_cluster_desired_shards',
      'Shards this cluster should own under the current assignment',
    )
    this.fencedGauge = createGauge(
      '@thesharks/discord-manager',
      'discord_cluster_fenced',
      'Whether this cluster has fenced itself off from coordination (1) or not (0)',
    )
  }

  public async start(): Promise<void> {
    await this.coordinator.ensureTotalShardsAgreement()
    this.running = true
    this.lastCoordinationSuccess = Date.now()
    this.fencedGauge.set(0, {})
    this.loop = this.run()
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        await this.tick()
      } catch (error) {
        // tick() handles coordination errors itself; anything reaching here
        // is a bug, and the loop must survive it.
        this.logger.error('Reconciler tick failed unexpectedly:', error)
      }
      await sleep(this.tickMillis)
    }
  }

  private async tick(): Promise<void> {
    let members: string[]
    try {
      await this.coordinator.heartbeat()
      members = await this.coordinator.liveMembers()
      this.lastCoordinationSuccess = Date.now()
    } catch (error) {
      this.coordinationErrorCounter.add(1)
      this.logger.warn('Cluster coordination unreachable:', error)
      await this.maybeFence()
      return
    }

    if (this.fenced) {
      this.fenced = false
      this.fencedGauge.set(0, {})
      this.logger.warn('Coordination recovered; resuming shard ownership')
    }

    this.memberGauge.set(members.length, {})

    // Only move shards once membership has been stable for the settle
    // window, so a rolling deploy or flapping cluster doesn't cause churn.
    // Renewal and crash recovery for currently desired shards continue
    // regardless.
    if (!sameMembers(members, this.lastMembers)) {
      this.logger.info(
        `Cluster membership changed: [${members.join(', ')}] (settling)`,
      )
      this.lastMembers = members
      this.membersStableSince = Date.now()
    } else if (
      Date.now() - this.membersStableSince >= this.settleMillis &&
      members.length > 0
    ) {
      const next = new Set(
        shardsFor(this.options.clusterId, members, this.options.totalShards),
      )
      if (!sameShardSet(next, this.desired)) {
        this.logger.info(
          `Assignment changed: now responsible for [${[...next].join(', ')}]`,
        )
      }
      this.desired = next
    }

    this.desiredShardGauge.set(this.desired.size, {})
    await this.reconcile()
  }

  private async reconcile(): Promise<void> {
    const current = new Set(this.host.currentShards())

    // Release what we no longer own — before anything else, so the new
    // owner's lease acquisition can succeed.
    for (const shardId of current) {
      if (this.desired.has(shardId)) continue
      this.logger.info(`Handing off shard ${shardId}`)
      await this.host.stop(shardId)
      await this.coordinator.releaseLease(shardId)
      this.handoffCounter.add(1, { direction: 'released' })
    }

    for (const shardId of this.desired) {
      if (current.has(shardId)) {
        // Keep the lease alive; losing it means another cluster owns the
        // shard now (e.g. we were fenced) and we must stand down.
        const held = await this.coordinator.renewLease(shardId)
        if (!held && !(await this.coordinator.acquireLease(shardId))) {
          this.logger.warn(
            `Lost the lease for shard ${shardId}; stopping our copy`,
          )
          await this.host.stop(shardId)
          this.handoffCounter.add(1, { direction: 'lost' })
          continue
        }
        // Crash recovery: the reconciler is the only respawn authority.
        if (!this.host.isAlive(shardId)) {
          this.logger.warn(`Shard ${shardId} is down; restarting it`)
          await this.host.start(shardId)
        }
        continue
      }

      if (await this.coordinator.acquireLease(shardId)) {
        this.logger.info(`Acquired shard ${shardId}`)
        await this.host.start(shardId)
        this.handoffCounter.add(1, { direction: 'acquired' })
      } else {
        const holder = await this.coordinator.leaseHolder(shardId)
        this.logger.debug(
          `Waiting for shard ${shardId} lease (held by ${holder ?? 'nobody'})`,
        )
      }
    }
  }

  /**
   * Without coordination we can't renew leases, so another cluster will
   * eventually acquire our shards. Stop serving them before that can
   * happen — a shard must never have two live sessions.
   */
  private async maybeFence(): Promise<void> {
    if (this.fenced) return
    if (Date.now() - this.lastCoordinationSuccess < this.fenceAfterMillis) {
      return
    }

    this.fenced = true
    this.fencedGauge.set(1, {})
    this.logger.error(
      'Coordination unreachable beyond the fencing deadline; stopping all shards',
    )
    for (const shardId of this.host.currentShards()) {
      await this.host.stop(shardId)
    }
  }

  /**
   * Stop reconciling without releasing anything; leases and the membership
   * entry expire on their own, exactly as if the process had crashed.
   */
  public async halt(): Promise<void> {
    this.running = false
    await this.loop?.catch(() => undefined)
  }

  public async shutdown(): Promise<void> {
    await this.halt()

    for (const shardId of this.host.currentShards()) {
      await this.host.stop(shardId)
      try {
        await this.coordinator.releaseLease(shardId)
      } catch {
        // lease will expire on its own
      }
    }
    try {
      await this.coordinator.withdraw()
    } catch {
      // membership entry will expire on its own
    }
  }
}

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((value, index) => value === sortedB[index])
}

function sameShardSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}
