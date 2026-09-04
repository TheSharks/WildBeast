import { setTimeout as sleep } from 'node:timers/promises'
import type { ILogger } from '@sapphire/framework'
import { createGauge, metrics } from '@thesharks/analytics'
import { shardsFor } from './assignment.mjs'
import {
  DEFAULT_FENCE_AFTER_MILLIS,
  DEFAULT_LEASE_TTL_MILLIS,
  FENCING_SAFETY_MARGIN_MILLIS,
  SHARD_STOP_GRACE_MILLIS,
} from './lifecycle.mjs'

// Shard lifecycle surface the reconciler needs (ShardingManager adapter in cluster; fakes in tests).
export interface ShardHost {
  currentShards(): number[]
  isAlive(shardId: number): boolean
  start(shardId: number): Promise<void>
  /** Graceful stop; resolves once the shard is dead. */
  stop(shardId: number): Promise<void>
}

// Redis coordination surface; keeps timing and lease-loss invariants testable.
export interface ReconcilerCoordinator {
  ensureTotalShardsAgreement(): Promise<void>
  heartbeat(): Promise<void>
  liveMembers(): Promise<string[]>
  withdraw(): Promise<void>
  acquireLease(shardId: number): Promise<boolean>
  renewLease(shardId: number): Promise<boolean>
  releaseLease(shardId: number): Promise<void>
  leaseHolder(shardId: number): Promise<string | null>
}

export interface ReconcilerOptions {
  clusterId: string
  totalShards: number
  /** Liveness/assignment interval. Default 5s. */
  tickMillis?: number
  /** Membership stability required before moving shards. Default 10s. */
  settleMillis?: number
  /** Fencing deadline; CHECK: FENCE_AFTER + STOP_GRACE + margin <= LEASE_TTL. Default 15s. */
  fenceAfterMillis?: number
  /** Lease TTL this timing is budgeted against; same CHECK. Default 45s. */
  leaseTtlMillis?: number
  /** Worst-case stop time for all owned shards. */
  stopGraceMillis?: number
}

export class ShardReconciler {
  private readonly tickMillis: number
  private readonly settleMillis: number
  private readonly fenceAfterMillis: number
  private readonly leaseTtlMillis: number
  private readonly stopGraceMillis: number

  // Instruments at construction: pre-init instruments bind permanently to the no-op meter.
  private readonly handoffCounter
  private readonly coordinationErrorCounter
  private readonly memberGauge
  private readonly desiredShardGauge
  private readonly fencedGauge

  private running = false
  private livenessLoop?: Promise<void>
  private loopAbort?: AbortController
  private reconcileWork?: Promise<void>
  private reconcileRequested = false
  private lastCoordinationSuccess = Date.now()
  private lastMembers: string[] = []
  private membersStableSince = 0
  private desired = new Set<number>()
  /** Held leases, including shards still spawning. */
  private readonly heldLeases = new Set<number>()
  // A lost lease fences only that shard until its local session dies.
  private readonly lostLeaseShards = new Set<number>()
  private readonly standDowns = new Map<number, Promise<void>>()
  private fenced = false

  public constructor(
    private readonly coordinator: ReconcilerCoordinator,
    private readonly host: ShardHost,
    private readonly options: ReconcilerOptions,
    private readonly logger: ILogger,
  ) {
    this.tickMillis = options.tickMillis ?? 5_000
    this.settleMillis = options.settleMillis ?? 10_000
    this.fenceAfterMillis =
      options.fenceAfterMillis ?? DEFAULT_FENCE_AFTER_MILLIS
    this.leaseTtlMillis = options.leaseTtlMillis ?? DEFAULT_LEASE_TTL_MILLIS
    this.stopGraceMillis = options.stopGraceMillis ?? SHARD_STOP_GRACE_MILLIS

    // CHECK: fenced clusters must stop shards before leases expire elsewhere.
    if (
      this.fenceAfterMillis +
        this.stopGraceMillis +
        FENCING_SAFETY_MARGIN_MILLIS >
      this.leaseTtlMillis
    ) {
      throw new Error(
        `Invalid fencing timing: FENCE_AFTER (${this.fenceAfterMillis}ms) + STOP_GRACE (${this.stopGraceMillis}ms) + ` +
          `margin (${FENCING_SAFETY_MARGIN_MILLIS}ms) must fit inside LEASE_TTL (${this.leaseTtlMillis}ms)`,
      )
    }

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
    this.loopAbort = new AbortController()
    this.livenessLoop = this.runLiveness(this.loopAbort.signal)
  }

  // Liveness must never wait behind lifecycle work (drains/spawns outlast the renewal budget).
  private async runLiveness(signal: AbortSignal): Promise<void> {
    while (this.running && !signal.aborted) {
      try {
        await this.livenessTick()
      } catch (error) {
        // livenessTick handles its own errors; anything here is a bug but must not kill the loop.
        this.logger.error(
          'Reconciler liveness tick failed unexpectedly:',
          error,
        )
      }

      try {
        await sleep(this.tickMillis, undefined, { signal })
      } catch {
        break
      }
    }
  }

  private async livenessTick(): Promise<void> {
    let members: string[]
    try {
      await this.coordinator.heartbeat()
      members = await this.coordinator.liveMembers()
      await this.renewHeldLeases()
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
    this.updateAssignment(members)
    this.desiredShardGauge.set(this.desired.size, {})
    this.requestReconcile()
  }

  private async renewHeldLeases(): Promise<void> {
    const results = await Promise.allSettled(
      [...this.heldLeases].map(async (shardId) => {
        if (this.lostLeaseShards.has(shardId)) return

        const renewed = await this.coordinator.renewLease(shardId)
        if (renewed || (await this.coordinator.acquireLease(shardId))) return

        this.markLeaseLost(shardId)
      }),
    )
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    if (failed) throw failed.reason
  }

  private updateAssignment(members: string[]): void {
    // Move shards only after the settle window so deploys/flaps don't churn; renewals continue meanwhile.
    if (!sameMembers(members, this.lastMembers)) {
      this.logger.info(
        `Cluster membership changed: [${members.join(', ')}] (settling)`,
      )
      this.lastMembers = members
      this.membersStableSince = Date.now()
      return
    }
    if (
      Date.now() - this.membersStableSince < this.settleMillis ||
      members.length === 0
    ) {
      return
    }

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

  // Coalesce rebalances behind one worker; liveness stays independent and passes never overlap.
  private requestReconcile(): void {
    if (!this.running || this.fenced) return
    this.reconcileRequested = true
    if (this.reconcileWork) return

    const work = this.drainReconciles()
    this.reconcileWork = work
    void work.finally(() => {
      if (this.reconcileWork === work) this.reconcileWork = undefined
      if (this.reconcileRequested) this.requestReconcile()
    })
  }

  private async drainReconciles(): Promise<void> {
    while (this.running && !this.fenced && this.reconcileRequested) {
      this.reconcileRequested = false
      try {
        await this.reconcile()
      } catch (error) {
        this.logger.error('Shard reconciliation failed:', error)
      }
    }
  }

  private async reconcile(): Promise<void> {
    const current = new Set(this.host.currentShards())
    const releasing = new Set(
      [...current, ...this.heldLeases].filter(
        (shardId) => !this.desired.has(shardId),
      ),
    )

    // Drain concurrently in one grace window; retain each lease until its shard is dead.
    await Promise.allSettled(
      [...releasing].map((shardId) => this.releaseShard(shardId)),
    )
    if (!this.running || this.fenced) return

    // Starts stay serial (Redis throttler paces them); liveness continues in parallel.
    for (const shardId of this.desired) {
      if (!this.running || this.fenced) return
      await this.ensureDesiredShard(shardId)
    }
  }

  private async releaseShard(shardId: number): Promise<void> {
    try {
      if (this.host.currentShards().includes(shardId)) {
        this.logger.info(`Handing off shard ${shardId}`)
        await this.host.stop(shardId)
      }
    } catch (error) {
      // Keep the lease on stop failure so no one else starts a live duplicate; retry later.
      this.logger.error(`Failed to stop shard ${shardId} for handoff:`, error)
      this.reconcileRequested = true
      return
    }

    if (this.heldLeases.has(shardId)) {
      // Worker is dead: DEL now so liveness can't race it; on DEL failure expiry still hands off safely.
      this.heldLeases.delete(shardId)
      try {
        await this.coordinator.releaseLease(shardId)
      } catch (error) {
        this.logger.warn(`Failed to release shard ${shardId} lease:`, error)
        return
      }
    }
    this.lostLeaseShards.delete(shardId)
    this.handoffCounter.add(1, { direction: 'released' })
  }

  private async ensureDesiredShard(shardId: number): Promise<void> {
    if (this.lostLeaseShards.has(shardId)) {
      this.scheduleStandDown(shardId)
      return
    }

    const alreadyRunning = this.host.currentShards().includes(shardId)
    let acquired = false
    if (!this.heldLeases.has(shardId)) {
      // Reclaim path: renew first since SET NX can't reacquire our own key; only double-failure marks loss.
      if (await this.coordinator.renewLease(shardId)) {
        this.heldLeases.add(shardId)
        this.logger.info(`Reclaimed shard ${shardId} lease after recovery`)
      } else {
        if (!(await this.coordinator.acquireLease(shardId))) {
          if (alreadyRunning) {
            this.markLeaseLost(shardId)
          } else {
            const holder = await this.coordinator.leaseHolder(shardId)
            this.logger.debug(
              `Waiting for shard ${shardId} lease (held by ${holder ?? 'nobody'})`,
            )
          }
          return
        }
        this.heldLeases.add(shardId)
        acquired = true
        this.logger.info(`Acquired shard ${shardId}`)
      }
    }

    if (!this.host.isAlive(shardId)) {
      this.logger.warn(
        alreadyRunning
          ? `Shard ${shardId} is down; restarting it`
          : `Starting shard ${shardId}`,
      )
      await this.host.start(shardId)
    }

    // CHECK: never leave a spawn serving after its assignment/lease vanished while waiting.
    if (
      !this.running ||
      this.fenced ||
      !this.desired.has(shardId) ||
      !this.heldLeases.has(shardId) ||
      this.lostLeaseShards.has(shardId)
    ) {
      await this.host.stop(shardId)
      // Worker is dead: DEL inline so the next pass doesn't block another owner.
      if (this.heldLeases.has(shardId)) {
        this.heldLeases.delete(shardId)
        try {
          await this.coordinator.releaseLease(shardId)
        } catch (error) {
          this.logger.warn(
            `Failed to release shard ${shardId} lease after aborted spawn:`,
            error,
          )
        }
      }
      return
    }

    if (acquired) {
      this.handoffCounter.add(1, { direction: 'acquired' })
    }
  }

  private markLeaseLost(shardId: number): void {
    if (this.lostLeaseShards.has(shardId)) return
    this.heldLeases.delete(shardId)
    this.lostLeaseShards.add(shardId)
    this.logger.warn(`Lost the lease for shard ${shardId}; stopping our copy`)
    this.scheduleStandDown(shardId)
  }

  private scheduleStandDown(shardId: number): void {
    if (this.standDowns.has(shardId)) return

    const work = (async () => {
      try {
        await this.host.stop(shardId)
        this.handoffCounter.add(1, { direction: 'lost' })
      } catch (error) {
        this.logger.error(`Failed to stop lease-lost shard ${shardId}:`, error)
      }
    })()
    this.standDowns.set(shardId, work)
    void work.finally(() => {
      this.standDowns.delete(shardId)
      if (!this.host.currentShards().includes(shardId)) {
        this.lostLeaseShards.delete(shardId)
      }
      if (this.running) this.requestReconcile()
    })
  }

  // CHECK: fence stops shards before another cluster acquires expired leases; never two live sessions.
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
    // Retain leases (no DEL) so recovery renews rather than racing SET NX; drop only on confirmed loss.
    const shards = this.host.currentShards()
    await Promise.allSettled(shards.map((shardId) => this.host.stop(shardId)))
  }

  // Halt liveness without releasing (leases/membership expire like a crash); wait for in-flight work.
  // CHECK: a pending spawn must observe `running = false` before shutdown() releases its lease.
  public async halt(): Promise<void> {
    this.running = false
    this.reconcileRequested = false
    this.loopAbort?.abort()
    await this.livenessLoop?.catch(() => undefined)
    await this.reconcileWork?.catch(() => undefined)
  }

  public async shutdown(): Promise<void> {
    await this.halt()

    const shardIds = new Set([
      ...this.host.currentShards(),
      ...this.heldLeases,
      ...this.standDowns.keys(),
    ])
    await Promise.allSettled(
      [...shardIds].map(async (shardId) => {
        const standDown = this.standDowns.get(shardId)
        if (standDown) {
          await standDown
        } else if (this.host.currentShards().includes(shardId)) {
          await this.host.stop(shardId)
        }

        if (this.heldLeases.has(shardId)) {
          try {
            await this.coordinator.releaseLease(shardId)
            this.heldLeases.delete(shardId)
          } catch {
            // Lease expires on its own.
          }
        }
      }),
    )
    try {
      await this.coordinator.withdraw()
    } catch {
      // Membership expires on its own.
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
