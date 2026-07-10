import { silentLogger, waitUntil } from '@thesharks/test-utils'
import { describe, expect, it } from 'vitest'
import {
  type ReconcilerCoordinator,
  type ShardHost,
  ShardReconciler,
} from '../src/sharding/reconciler.mjs'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

class FakeCoordinator implements ReconcilerCoordinator {
  public heartbeats = 0
  public renewals = 0
  public withdrawals = 0
  public forceLeaseLoss = false
  public readonly leases = new Set<number>()
  public readonly releases: number[] = []

  public async ensureTotalShardsAgreement(): Promise<void> {
    // This fake fleet always agrees.
  }

  public async heartbeat(): Promise<void> {
    this.heartbeats += 1
  }

  public async liveMembers(): Promise<string[]> {
    return ['cluster-a']
  }

  public async withdraw(): Promise<void> {
    this.withdrawals += 1
  }

  public async acquireLease(shardId: number): Promise<boolean> {
    if (this.forceLeaseLoss) return false
    this.leases.add(shardId)
    return true
  }

  public async renewLease(shardId: number): Promise<boolean> {
    this.renewals += 1
    return !this.forceLeaseLoss && this.leases.has(shardId)
  }

  public async releaseLease(shardId: number): Promise<void> {
    this.releases.push(shardId)
    this.leases.delete(shardId)
  }

  public async leaseHolder(shardId: number): Promise<string | null> {
    return this.leases.has(shardId) ? 'cluster-a' : null
  }
}

class ControlledHost implements ShardHost {
  public readonly shards = new Set<number>()
  public readonly starts: number[] = []
  public readonly stops: number[] = []
  public startGate?: Promise<void>
  public stopGate?: Promise<void>
  public addBeforeStartResolves = false

  public currentShards(): number[] {
    return [...this.shards]
  }

  public isAlive(shardId: number): boolean {
    return this.shards.has(shardId)
  }

  public async start(shardId: number): Promise<void> {
    this.starts.push(shardId)
    if (this.addBeforeStartResolves) this.shards.add(shardId)
    await this.startGate
    this.shards.add(shardId)
  }

  public async stop(shardId: number): Promise<void> {
    this.stops.push(shardId)
    await this.stopGate
    this.shards.delete(shardId)
  }
}

function reconciler(
  coordinator: FakeCoordinator,
  host: ControlledHost,
  totalShards = 1,
) {
  return new ShardReconciler(
    coordinator,
    host,
    {
      clusterId: 'cluster-a',
      totalShards,
      tickMillis: 10,
      settleMillis: 0,
      fenceAfterMillis: 100,
    },
    silentLogger,
  )
}

describe('ShardReconciler liveness', () => {
  it('keeps heartbeating and renewing while a shard start is blocked', async () => {
    const coordinator = new FakeCoordinator()
    const host = new ControlledHost()
    const start = deferred()
    host.startGate = start.promise
    const subject = reconciler(coordinator, host)
    await subject.start()

    await waitUntil(() => host.starts.length === 1)
    await waitUntil(
      () => coordinator.heartbeats >= 5 && coordinator.renewals >= 2,
    )

    // The lifecycle worker is still waiting, proving liveness did not wait
    // for host.start() before renewing the lease acquired for that shard.
    expect(host.shards.size).toBe(0)
    start.resolve()
    await waitUntil(() => host.shards.has(0))
    await subject.shutdown()
  })

  it('starts standing down immediately when renewal proves a lease was lost', async () => {
    const coordinator = new FakeCoordinator()
    const host = new ControlledHost()
    const start = deferred()
    host.startGate = start.promise
    host.addBeforeStartResolves = true
    const subject = reconciler(coordinator, host)
    await subject.start()

    await waitUntil(() => host.starts.length === 1)
    coordinator.forceLeaseLoss = true
    coordinator.leases.clear()
    await waitUntil(() => host.stops.includes(0))

    // stop() ran even though the lifecycle worker is still blocked in start().
    expect(host.shards.has(0)).toBe(false)
    start.resolve()
    await subject.shutdown()
  })

  it('stops all owned shards concurrently during graceful shutdown', async () => {
    const coordinator = new FakeCoordinator()
    const host = new ControlledHost()
    const subject = reconciler(coordinator, host, 3)
    await subject.start()
    await waitUntil(() => host.shards.size === 3)

    const stops = deferred()
    host.stopGate = stops.promise
    const shuttingDown = subject.shutdown()
    await waitUntil(() => host.stops.length === 3)

    // A sequential shutdown would have invoked only the first stop here.
    expect(new Set(host.stops)).toEqual(new Set([0, 1, 2]))
    stops.resolve()
    await shuttingDown
    expect(coordinator.releases.sort()).toEqual([0, 1, 2])
    expect(coordinator.withdrawals).toBe(1)
  })
})
