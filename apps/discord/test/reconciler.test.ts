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
  /** Heartbeats left to fail; Infinity simulates a sustained Redis outage. */
  public failHeartbeats = 0
  public readonly leases = new Set<number>()
  public readonly releases: number[] = []

  public async ensureTotalShardsAgreement(): Promise<void> {
    // This fake fleet always agrees.
  }

  public async heartbeat(): Promise<void> {
    if (this.failHeartbeats > 0) {
      this.failHeartbeats -= 1
      throw new Error('coordination unreachable')
    }
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

/**
 * Models real Redis SET NX: acquiring fails when the key already exists,
 * even when it holds our own id. A fence that clears local state without
 * DEL deadlocks against this unless the recovery path renews first.
 */
class StrictNxCoordinator extends FakeCoordinator {
  public override async acquireLease(shardId: number): Promise<boolean> {
    if (this.forceLeaseLoss) return false
    if (this.leases.has(shardId)) return false
    this.leases.add(shardId)
    return true
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

  it('tolerates a coordination blip shorter than the fencing deadline', async () => {
    const coordinator = new FakeCoordinator()
    const host = new ControlledHost()
    const subject = reconciler(coordinator, host)
    await subject.start()
    await waitUntil(() => host.shards.has(0))

    // One failed round at a 10ms tick is well inside the 100ms deadline.
    const heartbeatsBefore = coordinator.heartbeats
    coordinator.failHeartbeats = 1
    await waitUntil(() => coordinator.heartbeats >= heartbeatsBefore + 3)

    expect(host.stops).toEqual([])
    expect(host.shards.has(0)).toBe(true)
    await subject.shutdown()
  })

  it('fences once coordination stays unreachable past the deadline', async () => {
    const coordinator = new FakeCoordinator()
    const host = new ControlledHost()
    const subject = reconciler(coordinator, host)
    await subject.start()
    await waitUntil(() => host.shards.has(0))

    coordinator.failHeartbeats = Number.POSITIVE_INFINITY
    await waitUntil(() => !host.shards.has(0))

    // Recovery resumes ownership.
    coordinator.failHeartbeats = 0
    await waitUntil(() => host.shards.has(0))
    await subject.shutdown()
  })

  it('waits for an in-flight spawn before releasing its lease on shutdown', async () => {
    const coordinator = new FakeCoordinator()
    const host = new ControlledHost()
    const start = deferred()
    host.startGate = start.promise
    const subject = reconciler(coordinator, host)
    await subject.start()
    await waitUntil(() => host.starts.length === 1)

    let finished = false
    const shuttingDown = subject.shutdown().then(() => {
      finished = true
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    // The spawn is still pending, so its lease must still be held.
    expect(finished).toBe(false)
    expect(coordinator.releases).toEqual([])

    start.resolve()
    await shuttingDown
    expect(host.stops).toContain(0)
    expect(host.shards.has(0)).toBe(false)
    expect(coordinator.releases).toContain(0)
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

  it('rejects fencing timings that exceed the lease TTL', () => {
    const coordinator = new FakeCoordinator()
    const host = new ControlledHost()
    expect(
      () =>
        new ShardReconciler(
          coordinator,
          host,
          {
            clusterId: 'cluster-a',
            totalShards: 1,
            tickMillis: 10,
            settleMillis: 0,
            fenceAfterMillis: 30_000,
          },
          silentLogger,
        ),
    ).toThrow(/FENCE_AFTER.*STOP_GRACE.*LEASE_TTL/)
  })

  it('reclaims its own Redis lease on startup instead of waiting forever', async () => {
    // Redis still holds our id (a fence cleared local state without DEL).
    // SET NX alone can never reacquire our own key.
    const coordinator = new StrictNxCoordinator()
    coordinator.leases.add(0)
    const host = new ControlledHost()
    const subject = reconciler(coordinator, host)
    await subject.start()

    await waitUntil(() => host.shards.has(0), {
      timeoutMillis: 1_000,
      intervalMillis: 10,
    })
    expect(coordinator.renewals).toBeGreaterThanOrEqual(1)
    await subject.shutdown()
  })

  it('retains leases across fencing and renews them on recovery', async () => {
    const coordinator = new StrictNxCoordinator()
    const host = new ControlledHost()
    const subject = reconciler(coordinator, host)
    await subject.start()
    await waitUntil(() => host.shards.has(0))

    // Outage past the fence deadline: shards stop, but Redis still holds
    // our id (no DEL on the fence path).
    coordinator.failHeartbeats = Number.POSITIVE_INFINITY
    await waitUntil(() => !host.shards.has(0))
    expect(coordinator.leases.has(0)).toBe(true)

    // Recovery must renew (not SET NX, which can't reacquire our own key).
    coordinator.failHeartbeats = 0
    await waitUntil(() => host.shards.has(0), {
      timeoutMillis: 2_000,
      intervalMillis: 10,
    })
    await subject.shutdown()
  })

  it('releases a just-spawned lease inline instead of waiting a tick', async () => {
    const coordinator = new FakeCoordinator()
    const host = new ControlledHost()
    const start = deferred()
    host.startGate = start.promise
    const subject = reconciler(coordinator, host)
    await subject.start()
    await waitUntil(() => host.starts.length === 1)

    // Fence while the spawn is blocked; the post-spawn guard will stop it.
    coordinator.failHeartbeats = Number.POSITIVE_INFINITY
    await new Promise((resolve) => setTimeout(resolve, 150))

    start.resolve()
    await waitUntil(() => host.stops.includes(0), {
      timeoutMillis: 1_000,
      intervalMillis: 10,
    })
    // Inline DEL: no extra reconcile tick needed while still fenced.
    expect(coordinator.releases).toContain(0)
    coordinator.failHeartbeats = 0
    await subject.shutdown()
  })
})
