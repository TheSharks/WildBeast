import { silentLogger } from '@thesharks/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  FleetManager,
  type FleetOptions,
  HANDOFF_MESSAGE,
  SHUTDOWN_MESSAGE,
  type ShardingHost,
} from '../src/fleet/manager.mjs'
import type { EpochState } from '../src/sharding/epochs.mjs'

function fakeHost(ids: number[]) {
  const alive = new Map<number, { deaths: Array<() => void> }>()
  const events: string[] = []
  const host: ShardingHost & { die(id: number): void; events: string[] } = {
    events,
    shardIds: () => [...alive.keys()],
    isAlive: (id) => alive.has(id),
    start: async (id) => {
      alive.set(id, { deaths: [] })
      events.push(`start:${id}`)
    },
    spawnAll: async () => {
      for (const id of ids) alive.set(id, { deaths: [] })
      events.push('spawnAll')
      return ids.length
    },
    send: async (id, message) => {
      events.push(
        `send:${id}:${(message as { _wildbeast: string })._wildbeast}`,
      )
    },
    awaitDeath: (id) =>
      new Promise<void>((resolve) => {
        const shard = alive.get(id)
        if (!shard) return resolve()
        shard.deaths.push(resolve)
      }),
    kill: (id) => {
      events.push(`kill:${id}`)
      host.die(id)
    },
    forget: (id) => {
      events.push(`forget:${id}`)
      alive.delete(id)
    },
    setRespawn: (enabled) => {
      events.push(`respawn:${enabled}`)
    },
    die: (id) => {
      const shard = alive.get(id)
      alive.delete(id)
      for (const resolve of shard?.deaths ?? []) resolve()
    },
  }
  return host
}

describe('replacement fleet manager', () => {
  it('spawns a static shard list and stops every worker with the shutdown message', async () => {
    const host = fakeHost([0, 1])
    const fleet = new FleetManager({
      clusterId: 'c1',
      clustering: { mode: 'static', totalShards: 2, shardList: [0, 1] },
      host,
      logger: silentLogger,
      stopGraceMillis: 50,
    })
    await fleet.start()
    expect(fleet.phase).toBe('serving')
    const stop = fleet.stop()
    expect(fleet.stop()).toBe(stop)
    await vi.waitFor(() =>
      expect(host.events).toContain(`send:1:${SHUTDOWN_MESSAGE._wildbeast}`),
    )
    expect(fleet.isIntentionalStop(0)).toBe(true)
    host.die(0)
    // Shard 1 hangs; it is terminated after the grace period.
    await stop
    expect(host.events).toContain('kill:1')
    expect(fleet.phase).toBe('stopped')
    expect(host.isAlive(1)).toBe(false)
  })

  function autonomous(
    role: 'active' | 'pending',
    host: ShardingHost,
    overrides: Partial<FleetOptions> = {},
  ) {
    const state: EpochState = { epoch: 3, totalShards: 4 } as EpochState
    const membership = {
      heartbeat: vi.fn(async () => undefined),
      withdraw: vi.fn(async () => undefined),
    }
    let promoted = false
    const epochs = {
      resolve: vi.fn(async () => ({ role, state })),
      activeEpoch: vi.fn(async () => state),
      tryPromote: vi.fn(async () => promoted),
    }
    const reconciler = {
      start: vi.fn(async () => undefined),
      shutdown: vi.fn(async () => undefined),
    }
    const seen: number[] = []
    const fleet = new FleetManager({
      clusterId: 'c1',
      clustering: { mode: 'autonomous', totalShards: 4 },
      host,
      logger: silentLogger,
      stopGraceMillis: 50,
      onEpoch: (resolved) => seen.push(resolved.epoch),
      coordination: {
        epochs,
        membership: () => membership as never,
        reconciler: () => reconciler,
      },
      ...overrides,
    })
    return {
      fleet,
      epochs,
      membership,
      reconciler,
      seen,
      promote: () => {
        promoted = true
      },
    }
  }

  it('starts the reconciler in the active epoch and shuts it down first', async () => {
    const host = fakeHost([])
    const { fleet, reconciler, seen } = autonomous('active', host)
    await fleet.start()
    expect(fleet.phase).toBe('serving')
    expect(seen).toEqual([3])
    expect(host.events).toContain('respawn:false')
    expect(reconciler.start).toHaveBeenCalledOnce()
    await fleet.stop()
    expect(reconciler.shutdown).toHaveBeenCalledOnce()
    expect(fleet.phase).toBe('stopped')
  })

  it('parks a pending cluster, keeps heartbeating, and withdraws if stopped before activation', async () => {
    const host = fakeHost([])
    const { fleet, membership, reconciler } = autonomous('pending', host)
    const start = fleet.start()
    await vi.waitFor(() => expect(fleet.phase).toBe('parked'))
    await vi.waitFor(() => expect(membership.heartbeat).toHaveBeenCalled())
    await fleet.stop()
    await start
    expect(membership.withdraw).toHaveBeenCalledOnce()
    expect(reconciler.start).not.toHaveBeenCalled()
    expect(fleet.phase).toBe('stopped')
  })

  it('hands owned shards off with a resumable stop when the reconciler moves them', async () => {
    const host = fakeHost([])
    let shardHost!: Parameters<
      NonNullable<NonNullable<FleetOptions['coordination']>['reconciler']>
    >[1]
    const { fleet } = autonomous('active', host, {
      coordination: {
        epochs: {
          resolve: async () => ({
            role: 'active',
            state: { epoch: 1, totalShards: 2 } as EpochState,
          }),
          activeEpoch: async () => ({ epoch: 1, totalShards: 2 }) as EpochState,
          tryPromote: async () => false,
        },
        membership: () =>
          ({
            heartbeat: async () => undefined,
            withdraw: async () => undefined,
          }) as never,
        reconciler: (_coordinator, given) => {
          shardHost = given
          return {
            start: async () => undefined,
            shutdown: async () => undefined,
          }
        },
      },
    })
    await fleet.start()
    await shardHost.start(1)
    expect(host.isAlive(1)).toBe(true)
    const stop = shardHost.stop(1)
    await vi.waitFor(() =>
      expect(host.events).toContain(`send:1:${HANDOFF_MESSAGE._wildbeast}`),
    )
    expect(fleet.isIntentionalStop(1)).toBe(true)
    host.die(1)
    await stop
    expect(host.events).toContain('forget:1')
    expect(fleet.isIntentionalStop(1)).toBe(false)
    await fleet.stop()
  })

  it('reports a stale configuration when the fleet moves to a newer epoch', async () => {
    const host = fakeHost([])
    const onStale = vi.fn()
    const { fleet, epochs } = autonomous('active', host, {
      onStale,
      epochWatchMillis: 5,
    })
    await fleet.start()
    epochs.activeEpoch.mockResolvedValue({
      epoch: 4,
      totalShards: 8,
    } as EpochState)
    await vi.waitFor(() => expect(onStale).toHaveBeenCalled())
    await fleet.stop()
  })
})
