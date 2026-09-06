import { Redis } from 'ioredis'
import type { ClusteringConfig } from '../sharding/config.mjs'
import { ClusterCoordinator } from '../sharding/coordination.mjs'
import {
  awaitEpochActivation,
  EpochCoordinator,
  type EpochState,
  epochKeyPrefix,
} from '../sharding/epochs.mjs'
import { SHARD_STOP_GRACE_MILLIS } from '../sharding/lifecycle.mjs'
import { type ShardHost, ShardReconciler } from '../sharding/reconciler.mjs'
import type { RedisConnectionOptions } from '../utils/redis.mjs'

/** Lifecycle of shard workers, as the manager sees it. */
export interface ShardingHost {
  shardIds(): number[]
  isAlive(shardId: number): boolean
  /** Create the shard if needed and spawn it; resolves once spawned. */
  start(shardId: number): Promise<void>
  /** Static mode: spawn the configured list; resolves with the count. */
  spawnAll(): Promise<number>
  send(shardId: number, message: unknown): Promise<void>
  awaitDeath(shardId: number): Promise<void>
  kill(shardId: number): void
  /** Drop a stopped shard so a later start recreates it. */
  forget(shardId: number): void
  setRespawn(enabled: boolean): void
}

export interface FleetLogger {
  debug(...values: readonly unknown[]): void
  info(...values: readonly unknown[]): void
  warn(...values: readonly unknown[]): void
  error(...values: readonly unknown[]): void
  fatal(...values: readonly unknown[]): void
}

export interface EpochSource {
  resolve(): Promise<{ role: 'active' | 'pending'; state: EpochState }>
  activeEpoch(): Promise<EpochState | null>
  tryPromote(pending: EpochState): Promise<boolean>
}

export interface Membership {
  heartbeat(): Promise<void>
  withdraw(): Promise<void>
}

export interface Reconciler {
  start(): Promise<void>
  shutdown(): Promise<void>
}

export interface FleetOptions {
  clusterId: string
  clustering: ClusteringConfig
  host: ShardingHost
  logger: FleetLogger
  redis?: RedisConnectionOptions
  stopGraceMillis?: number
  epochWatchMillis?: number
  /** Called before shards spawn so workers inherit the resolved epoch. */
  onEpoch?: (state: EpochState) => void
  /** The fleet moved on; this process's configuration is stale. */
  onStale?: (active: EpochState) => void
  /** Test seams; production builds Redis-backed coordination. */
  coordination?: {
    epochs: EpochSource
    membership(state: EpochState): Membership & ShardReconcilerCoordinator
    reconciler?: (
      coordinator: ShardReconcilerCoordinator,
      host: ShardHost,
      state: EpochState,
    ) => Reconciler
  }
}

type ShardReconcilerCoordinator = ConstructorParameters<
  typeof ShardReconciler
>[0]

export const SHUTDOWN_MESSAGE = { _wildbeast: 'shutdown' }
// Handoffs skip the gateway close so the session stays resumable.
export const HANDOFF_MESSAGE = { _wildbeast: 'handoff' }

export type FleetPhase =
  | 'new'
  | 'starting'
  | 'parked'
  | 'serving'
  | 'stopping'
  | 'stopped'

/**
 * Owns shard workers for one cluster. Static mode spawns a fixed list;
 * autonomous mode joins the fleet epoch and lets the reconciler own shards
 * through Redis leases. Stopping is idempotent and never leaves a worker
 * alive past the grace period.
 */
export class FleetManager {
  private currentPhase: FleetPhase = 'new'
  private readonly intentionalStops = new Set<number>()
  private readonly abort = new AbortController()
  private readonly stopGraceMillis: number
  private redis?: Redis
  private parked?: Membership
  private reconciler?: Reconciler
  private watchdog?: NodeJS.Timeout
  private stopping?: Promise<void>
  private startup?: Promise<void>

  public constructor(private readonly options: FleetOptions) {
    this.stopGraceMillis = options.stopGraceMillis ?? SHARD_STOP_GRACE_MILLIS
  }

  public get phase(): FleetPhase {
    return this.currentPhase
  }

  public start(): Promise<void> {
    if (this.startup) return this.startup
    if (this.currentPhase !== 'new')
      return Promise.reject(new Error('Fleet cannot restart'))
    this.currentPhase = 'starting'
    this.startup = this.run()
    return this.startup
  }

  private async run(): Promise<void> {
    const { clustering, host, logger } = this.options
    if (clustering.mode === 'static') {
      const count = await host.spawnAll()
      if (this.abort.signal.aborted) return
      this.currentPhase = 'serving'
      logger.info(`Spawned ${count} shard(s)`)
      return
    }
    // The reconciler is the only respawn authority in autonomous mode.
    host.setRespawn(false)
    const coordination = this.options.coordination ?? this.redisCoordination()
    const resolution = await coordination.epochs.resolve()
    let epoch = resolution.state
    if (resolution.role === 'pending') {
      logger.warn(
        `Shard total ${clustering.totalShards} differs from the active epoch; parked as epoch ${epoch.epoch} member until the old fleet drains`,
      )
      this.currentPhase = 'parked'
      const parked = coordination.membership(epoch)
      this.parked = parked
      const activated = await awaitEpochActivation({
        epochs: coordination.epochs as EpochCoordinator,
        pending: epoch,
        heartbeat: () => parked.heartbeat(),
        signal: this.abort.signal,
        logger: logger as never,
      })
      if (!activated) {
        await parked.withdraw().catch(() => undefined)
        this.parked = undefined
        return
      }
      // Promotion keeps the same membership; the reconciler continues it.
      this.parked = undefined
      epoch = { ...epoch }
      logger.info(
        `Epoch ${epoch.epoch} activated (${epoch.totalShards} shards)`,
      )
    }
    if (this.abort.signal.aborted) return
    this.options.onEpoch?.(epoch)
    const coordinator = coordination.membership(epoch)
    const shardHost: ShardHost = {
      currentShards: () => host.shardIds(),
      isAlive: (shardId) => host.isAlive(shardId),
      start: (shardId) => host.start(shardId),
      stop: async (shardId) => {
        // Reconciler stops are handoffs: the next owner resumes the session.
        await this.stopShard(shardId, HANDOFF_MESSAGE)
        host.forget(shardId)
      },
    }
    const reconciler =
      coordination.reconciler?.(coordinator, shardHost, epoch) ??
      new ShardReconciler(
        coordinator,
        shardHost,
        { clusterId: this.options.clusterId, totalShards: epoch.totalShards },
        logger as never,
      )
    this.reconciler = reconciler
    await reconciler.start()
    this.currentPhase = 'serving'
    logger.info(
      `Reconciler started in epoch ${epoch.epoch}; shard ownership follows fleet membership`,
    )
    const current = epoch
    this.watchdog = setInterval(() => {
      void coordination.epochs
        .activeEpoch()
        .then((active) => {
          if (active && active.epoch !== current.epoch) {
            logger.fatal(
              `Fleet moved to epoch ${active.epoch} (${active.totalShards} shards); this cluster's configuration is stale`,
            )
            this.options.onStale?.(active)
          }
        })
        .catch(() => {
          // Coordination loss is handled by the reconciler's fencing.
        })
    }, this.options.epochWatchMillis ?? 10_000)
    this.watchdog.unref()
  }

  private redisCoordination(): NonNullable<FleetOptions['coordination']> {
    if (this.options.clustering.mode !== 'autonomous')
      throw new Error('Autonomous coordination requires autonomous mode')
    if (!this.options.redis)
      throw new Error('Autonomous clustering requires Redis')
    const redis = new Redis(this.options.redis)
    this.redis = redis
    const { totalShards } = this.options.clustering
    return {
      epochs: new EpochCoordinator(redis, { totalShards }),
      membership: (state) =>
        new ClusterCoordinator(redis, {
          clusterId: this.options.clusterId,
          totalShards: state.totalShards,
          keyPrefix: epochKeyPrefix(state.epoch),
        }),
    }
  }

  /** Ask a worker to leave and make sure it does. */
  public async stopShard(
    shardId: number,
    message: { _wildbeast: string } = SHUTDOWN_MESSAGE,
  ): Promise<void> {
    const { host, logger } = this.options
    if (!host.isAlive(shardId)) return
    this.intentionalStops.add(shardId)
    try {
      const death = host.awaitDeath(shardId)
      // Signals only reach the main thread; worker-mode shards rely on this
      // message to flush before exiting.
      await host.send(shardId, message).catch(() => undefined)
      if (!(await withinGrace(death, this.stopGraceMillis))) {
        logger.warn(`Shard ${shardId} did not exit in time; terminating it`)
        try {
          host.kill(shardId)
        } catch {
          // already dead
        }
      }
    } finally {
      this.intentionalStops.delete(shardId)
    }
  }

  public isIntentionalStop(shardId: number): boolean {
    return (
      this.currentPhase === 'stopping' || this.intentionalStops.has(shardId)
    )
  }

  public stop(): Promise<void> {
    if (this.stopping) return this.stopping
    this.currentPhase = 'stopping'
    this.stopping = this.finish()
    return this.stopping
  }

  private async finish(): Promise<void> {
    const { host, logger } = this.options
    host.setRespawn(false)
    this.abort.abort()
    if (this.watchdog) clearInterval(this.watchdog)
    await this.startup?.catch(() => undefined)
    logger.info('Shutting down: asking shards to exit')
    try {
      await this.parked?.withdraw()
    } catch {
      // Membership expires on its own.
    }
    if (this.reconciler) {
      // Stops owned shards, releases leases and withdraws from the fleet.
      await this.reconciler.shutdown()
    } else {
      await Promise.all(
        host.shardIds().map((shardId) => this.stopShard(shardId)),
      )
    }
    try {
      this.redis?.disconnect()
    } catch {
      // nothing to do
    }
    this.currentPhase = 'stopped'
  }
}

async function withinGrace(
  promise: Promise<unknown>,
  timeoutMillis: number,
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMillis)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
