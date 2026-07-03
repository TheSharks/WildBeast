import type { Redis } from 'ioredis'

export const DEFAULT_MEMBERSHIP_TTL_MILLIS = 15_000

export interface CoordinatorOptions {
  clusterId: string
  totalShards: number
  /** How long a cluster stays a member without a heartbeat. Default 15s. */
  membershipTtlMillis?: number
  /** How long a shard lease survives without renewal. Default 30s. */
  leaseTtlMillis?: number
  keyPrefix?: string
}

const RENEW_LEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0
`

const RELEASE_LEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

/**
 * Redis-backed cluster coordination: a membership set (sorted set scored by
 * Redis server time, so cross-host clock skew doesn't matter) and one lease
 * per shard. Assignment is computed deterministically from membership; the
 * leases are the safety net that guarantees a shard never has two owners
 * even when assignment views diverge — a new owner's acquire fails until
 * the previous owner releases or its lease expires.
 */
export class ClusterCoordinator {
  private readonly clusterId: string
  private readonly totalShards: number
  private readonly membershipTtlMillis: number
  private readonly leaseTtlMillis: number
  private readonly prefix: string

  public constructor(
    private readonly redis: Redis,
    options: CoordinatorOptions,
  ) {
    this.clusterId = options.clusterId
    this.totalShards = options.totalShards
    this.membershipTtlMillis =
      options.membershipTtlMillis ?? DEFAULT_MEMBERSHIP_TTL_MILLIS
    this.leaseTtlMillis = options.leaseTtlMillis ?? 30_000
    this.prefix = options.keyPrefix ?? 'wildbeast'
  }

  private key(...parts: Array<string | number>): string {
    return [this.prefix, ...parts].join(':')
  }

  private async serverTimeMillis(): Promise<number> {
    const [seconds, microseconds] = await this.redis.time()
    return Number(seconds) * 1_000 + Math.floor(Number(microseconds) / 1_000)
  }

  /**
   * Every cluster in a fleet must agree on the shard total; a mismatch means
   * clusters would route the same guild to different shards. First cluster
   * up wins; later ones must match it.
   */
  public async ensureTotalShardsAgreement(): Promise<void> {
    const key = this.key('total_shards')
    await this.redis.set(key, String(this.totalShards), 'NX')
    const agreed = await this.redis.get(key)
    if (agreed !== String(this.totalShards)) {
      throw new Error(
        `Cluster fleet disagrees on total shards: fleet has ${agreed}, this cluster is configured for ${this.totalShards}. ` +
          `Changing the total requires taking the whole fleet down (and deleting ${key}).`,
      )
    }
  }

  public async heartbeat(): Promise<void> {
    const now = await this.serverTimeMillis()
    const key = this.key('clusters')
    await this.redis.zadd(key, now, this.clusterId)
    await this.redis.zremrangebyscore(
      key,
      '-inf',
      now - this.membershipTtlMillis,
    )
  }

  public async liveMembers(): Promise<string[]> {
    const now = await this.serverTimeMillis()
    return this.redis.zrangebyscore(
      this.key('clusters'),
      now - this.membershipTtlMillis,
      '+inf',
    )
  }

  public async withdraw(): Promise<void> {
    await this.redis.zrem(this.key('clusters'), this.clusterId)
  }

  public async acquireLease(shardId: number): Promise<boolean> {
    const acquired = await this.redis.set(
      this.key('shard', shardId, 'owner'),
      this.clusterId,
      'PX',
      this.leaseTtlMillis,
      'NX',
    )
    return acquired === 'OK'
  }

  /** Returns false when the lease is no longer held by this cluster. */
  public async renewLease(shardId: number): Promise<boolean> {
    const result = await this.redis.eval(
      RENEW_LEASE,
      1,
      this.key('shard', shardId, 'owner'),
      this.clusterId,
      String(this.leaseTtlMillis),
    )
    return result === 1
  }

  public async releaseLease(shardId: number): Promise<void> {
    await this.redis.eval(
      RELEASE_LEASE,
      1,
      this.key('shard', shardId, 'owner'),
      this.clusterId,
    )
  }

  public async leaseHolder(shardId: number): Promise<string | null> {
    return this.redis.get(this.key('shard', shardId, 'owner'))
  }
}
