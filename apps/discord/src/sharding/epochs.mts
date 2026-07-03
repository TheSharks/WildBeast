import { setTimeout as sleep } from 'node:timers/promises'
import type { ILogger } from '@sapphire/framework'
import type { Redis } from 'ioredis'
import { DEFAULT_MEMBERSHIP_TTL_MILLIS } from './coordination.mjs'

/**
 * An epoch is one generation of the fleet with a fixed shard total. All
 * coordination state (membership, leases, sessions) is scoped to an epoch,
 * so two generations never see each other's state.
 *
 * Changing WILDBEAST_SHARDING_TOTAL is a fleet-wide event: guild→shard
 * routing is `(guild_id >> 22) % total`, so clusters with different totals
 * must never serve at the same time. Migration works with a rolling deploy:
 * clusters restarted with the new total park as *pending* members of the
 * next epoch while old-config clusters keep serving (absorbing shards as
 * their peers drain, v1 behavior). The moment the last old-config cluster
 * is gone, one pending cluster atomically promotes the new epoch and the
 * parked fleet starts serving. A cluster restarted with a *stale* total
 * parks harmlessly forever (the active epoch never empties while correctly
 * configured clusters serve) — visible in logs and metrics, fixed by
 * correcting its config.
 */
export interface EpochState {
  epoch: number
  totalShards: number
}

export function epochKeyPrefix(epoch: number, base = 'wildbeast'): string {
  return `${base}:e${epoch}`
}

// Promote the pending epoch iff the active epoch has no live members and
// the active document is exactly what the caller observed (CAS).
const PROMOTE = `
local time = redis.call('TIME')
local now = time[1] * 1000 + math.floor(time[2] / 1000)
local live = redis.call('ZCOUNT', KEYS[1], now - tonumber(ARGV[1]), '+inf')
if live > 0 then
  return 0
end
if redis.call('GET', KEYS[2]) ~= ARGV[2] then
  return 0
end
redis.call('SET', KEYS[2], ARGV[3])
redis.call('DEL', KEYS[3])
return 1
`

export interface EpochCoordinatorOptions {
  totalShards: number
  keyPrefix?: string
  /** Must match the ClusterCoordinator's membership TTL. */
  membershipTtlMillis?: number
}

export class EpochCoordinator {
  private readonly totalShards: number
  private readonly prefix: string
  private readonly membershipTtlMillis: number

  public constructor(
    private readonly redis: Redis,
    options: EpochCoordinatorOptions,
  ) {
    this.totalShards = options.totalShards
    this.prefix = options.keyPrefix ?? 'wildbeast'
    this.membershipTtlMillis =
      options.membershipTtlMillis ?? DEFAULT_MEMBERSHIP_TTL_MILLIS
  }

  private get epochKey(): string {
    return `${this.prefix}:epoch`
  }

  private get pendingKey(): string {
    return `${this.prefix}:epoch:pending`
  }

  private clustersKeyFor(epoch: number): string {
    return `${epochKeyPrefix(epoch, this.prefix)}:clusters`
  }

  public async activeEpoch(): Promise<EpochState | null> {
    const raw = await this.redis.get(this.epochKey)
    return raw ? (JSON.parse(raw) as EpochState) : null
  }

  /**
   * Determine which epoch this cluster belongs to: the active one when the
   * totals match, otherwise a pending next epoch it must wait on.
   */
  public async resolve(): Promise<{
    state: EpochState
    role: 'active' | 'pending'
  }> {
    await this.redis.set(
      this.epochKey,
      JSON.stringify({ epoch: 1, totalShards: this.totalShards }),
      'NX',
    )
    const active = (await this.activeEpoch()) as EpochState

    if (active.totalShards === this.totalShards) {
      // Clear a nonsensical leftover proposal for the total that is
      // already active (e.g. a config flip-flop that never completed).
      const pendingRaw = await this.redis.get(this.pendingKey)
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw) as EpochState
        if (pending.totalShards === active.totalShards) {
          await this.redis.del(this.pendingKey)
        }
      }
      return { state: active, role: 'active' }
    }

    const proposed: EpochState = {
      epoch: active.epoch + 1,
      totalShards: this.totalShards,
    }
    await this.redis.set(this.pendingKey, JSON.stringify(proposed), 'NX')
    const pending = JSON.parse(
      (await this.redis.get(this.pendingKey)) as string,
    ) as EpochState

    if (pending.totalShards !== this.totalShards) {
      throw new Error(
        `Conflicting shard total migrations: a migration to ${pending.totalShards} shards is already pending, ` +
          `this cluster proposes ${this.totalShards}. Fix the fleet configuration (and delete ${this.pendingKey} if the pending migration is wrong).`,
      )
    }
    return { state: pending, role: 'pending' }
  }

  /**
   * Returns true once `pending` is the active epoch — either because this
   * call promoted it (active epoch drained) or another cluster already did.
   */
  public async tryPromote(pending: EpochState): Promise<boolean> {
    const activeRaw = await this.redis.get(this.epochKey)
    if (!activeRaw) return false

    const active = JSON.parse(activeRaw) as EpochState
    if (active.epoch === pending.epoch) {
      return true
    }
    if (active.epoch !== pending.epoch - 1) {
      return false
    }

    const result = await this.redis.eval(
      PROMOTE,
      3,
      this.clustersKeyFor(active.epoch),
      this.epochKey,
      this.pendingKey,
      String(this.membershipTtlMillis),
      activeRaw,
      JSON.stringify(pending),
    )
    return result === 1
  }
}

/**
 * Park until the pending epoch becomes active. Keeps heartbeating the
 * pending epoch's membership so the parked fleet's assignment converges the
 * instant promotion happens. Returns false when aborted (shutdown while
 * parked).
 */
export async function awaitEpochActivation(options: {
  epochs: EpochCoordinator
  pending: EpochState
  heartbeat(): Promise<void>
  pollMillis?: number
  signal?: AbortSignal
  logger?: ILogger
}): Promise<boolean> {
  const pollMillis = options.pollMillis ?? 5_000

  while (!options.signal?.aborted) {
    try {
      await options.heartbeat()
      if (await options.epochs.tryPromote(options.pending)) {
        return true
      }
    } catch (error) {
      options.logger?.warn('Epoch coordination unreachable:', error)
    }

    try {
      await sleep(pollMillis, undefined, { signal: options.signal })
    } catch {
      return false
    }
  }
  return false
}
