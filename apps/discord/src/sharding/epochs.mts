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

export const DEFAULT_PENDING_EPOCH_TTL_MILLIS = 45_000

// Refresh only the proposal this caller joined. GET + PEXPIRE as separate
// commands could extend a different proposal that replaced an expired key
// between them.
const REFRESH_PENDING = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0
`

// Proposals written by versions before they had a TTL must not preserve the
// original manual-Redis-surgery failure mode. Give such a legacy value one
// expiry window, but never refresh a conflicting proposal that already has a
// lease of its own.
const EXPIRE_LEGACY_PENDING = `
if redis.call('GET', KEYS[1]) == ARGV[1] and redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0
`

// Promote the pending epoch iff the active epoch has no live members and
// both the active and pending documents are exactly what the caller observed
// (CAS). The pending comparison matters once stale proposals can expire and
// be replaced while an old proposer is still recovering.
const PROMOTE = `
local time = redis.call('TIME')
local now = time[1] * 1000 + math.floor(time[2] / 1000)
if redis.call('GET', KEYS[3]) ~= ARGV[3] then
  return 0
end
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
  /**
   * How long a proposal survives without a parked cluster refreshing it.
   * Default 45s: three default membership TTLs and nine activation polls.
   */
  pendingTtlMillis?: number
}

export class EpochCoordinator {
  private readonly totalShards: number
  private readonly prefix: string
  private readonly membershipTtlMillis: number
  private readonly pendingTtlMillis: number

  public constructor(
    private readonly redis: Redis,
    options: EpochCoordinatorOptions,
  ) {
    this.totalShards = options.totalShards
    this.prefix = options.keyPrefix ?? 'wildbeast'
    this.membershipTtlMillis =
      options.membershipTtlMillis ?? DEFAULT_MEMBERSHIP_TTL_MILLIS
    this.pendingTtlMillis =
      options.pendingTtlMillis ?? DEFAULT_PENDING_EPOCH_TTL_MILLIS
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
    const proposedRaw = JSON.stringify(proposed)
    const pendingRaw = await this.claimPending(proposedRaw)
    const pending = JSON.parse(pendingRaw) as EpochState

    if (pending.totalShards !== this.totalShards) {
      throw new Error(
        `Conflicting shard total migrations: a migration to ${pending.totalShards} shards is already pending, ` +
          `this cluster proposes ${this.totalShards}. Fix the fleet configuration; an abandoned proposal expires automatically.`,
      )
    }
    return { state: pending, role: 'pending' }
  }

  /** Claim an empty proposal slot or refresh the identical proposal another
   * pending cluster already created. A key can expire between SET and GET, so
   * retry once rather than turning a recoverable race into a boot failure. */
  private async claimPending(proposedRaw: string): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.redis.set(
        this.pendingKey,
        proposedRaw,
        'PX',
        this.pendingTtlMillis,
        'NX',
      )
      const current = await this.redis.get(this.pendingKey)
      if (!current) continue
      if (current === proposedRaw) {
        if (!(await this.refreshPending(proposedRaw))) continue
      } else {
        await this.expireLegacyPending(current)
      }
      return current
    }
    throw new Error('Pending shard-total proposal expired while claiming it')
  }

  private async refreshPending(pendingRaw: string): Promise<boolean> {
    const refreshed = await this.redis.eval(
      REFRESH_PENDING,
      1,
      this.pendingKey,
      pendingRaw,
      String(this.pendingTtlMillis),
    )
    return refreshed === 1
  }

  private async expireLegacyPending(pendingRaw: string): Promise<void> {
    await this.redis.eval(
      EXPIRE_LEGACY_PENDING,
      1,
      this.pendingKey,
      pendingRaw,
      String(this.pendingTtlMillis),
    )
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
      return active.totalShards === pending.totalShards
    }
    if (active.epoch !== pending.epoch - 1) {
      return false
    }

    const pendingRaw = JSON.stringify(pending)
    if (!(await this.refreshPending(pendingRaw))) {
      // This proposal expired and another total may now occupy the slot. An
      // old waiter must never promote itself over the replacement.
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
      pendingRaw,
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
