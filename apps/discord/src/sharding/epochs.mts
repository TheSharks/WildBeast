import { setTimeout as sleep } from 'node:timers/promises'
import type { ILogger } from '@sapphire/framework'
import type { Redis } from 'ioredis'
import { DEFAULT_MEMBERSHIP_TTL_MILLIS } from './coordination.mjs'

// Epoch = one fleet generation with fixed shard total; all coordination state is epoch-scoped.
// CHECK: mixed totals must never serve together since routing is `(guild_id >> 22) % total`.
export interface EpochState {
  epoch: number
  totalShards: number
}

export function epochKeyPrefix(epoch: number, base = 'wildbeast'): string {
  return `${base}:e${epoch}`
}

// Lost to a concurrent migration; requires restart, polling can never resolve it.
export class EpochConflictError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'EpochConflictError'
  }
}

export const DEFAULT_PENDING_EPOCH_TTL_MILLIS = 45_000

// Refresh only our own proposal; separate GET + PEXPIRE could extend a replacement.
const REFRESH_PENDING = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0
`

// Give TTL-less legacy proposals one expiry window; never refresh a conflicting leased proposal.
const EXPIRE_LEGACY_PENDING = `
if redis.call('GET', KEYS[1]) == ARGV[1] and redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0
`

// Promote iff active epoch drained and both docs match observed values (CAS).
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
  /** Proposal survival without refresh. Default 45s. */
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

  // Active epoch when totals match, else the pending epoch to wait on.
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
      // Drop leftover proposals for the already-active total.
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
      throw new EpochConflictError(
        `Conflicting shard total migrations: a migration to ${pending.totalShards} shards is already pending, ` +
          `this cluster proposes ${this.totalShards}. Fix the fleet configuration; an abandoned proposal expires automatically.`,
      )
    }
    return { state: pending, role: 'pending' }
  }

  // Claim the slot or join an identical proposal; retry once across a SET/GET expiry race.
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

  // True once pending is active; throws EpochConflictError when superseded (waiting can't help).
  public async tryPromote(pending: EpochState): Promise<boolean> {
    const activeRaw = await this.redis.get(this.epochKey)
    if (!activeRaw) {
      throw new EpochConflictError(
        `Epoch state missing while waiting on epoch ${pending.epoch} (${pending.totalShards} shards): ` +
          `the active epoch key is gone. Fix the fleet configuration and restart this cluster rather than polling forever.`,
      )
    }

    const active = JSON.parse(activeRaw) as EpochState
    if (active.epoch === pending.epoch) {
      if (active.totalShards !== pending.totalShards) {
        throw new EpochConflictError(
          `Conflicting shard total migrations: epoch ${active.epoch} was promoted with ${active.totalShards} shards ` +
            `while this cluster waited on ${pending.totalShards}. Fix the fleet configuration and restart this cluster.`,
        )
      }
      return true
    }
    if (active.epoch > pending.epoch) {
      throw new EpochConflictError(
        `Conflicting shard total migrations: active epoch moved to ${active.epoch} (${active.totalShards} shards) ` +
          `while this cluster waited on epoch ${pending.epoch} (${pending.totalShards} shards). ` +
          `This proposal is superseded; fix the fleet configuration and restart this cluster.`,
      )
    }
    if (active.epoch !== pending.epoch - 1) {
      return false
    }

    const pendingRaw = JSON.stringify(pending)
    if (!(await this.refreshPending(pendingRaw))) {
      // Proposal expired: re-claim so migration can finish, never promote over a replacement.
      const currentRaw = await this.claimPending(pendingRaw)
      if (currentRaw !== pendingRaw) {
        const current = JSON.parse(currentRaw) as EpochState
        throw new EpochConflictError(
          `Conflicting shard total migrations: this cluster's expired proposal for ${pending.totalShards} shards ` +
            `was replaced by one for ${current.totalShards}. Fix the fleet configuration and restart this cluster.`,
        )
      }
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

// Park heartbeating pending membership until promotion; false when aborted, throws when superseded.
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
      if (error instanceof EpochConflictError) throw error
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
