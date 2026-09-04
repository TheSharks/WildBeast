import type { Redis } from 'ioredis'
import { DEFAULT_LEASE_TTL_MILLIS } from './lifecycle.mjs'

export const DEFAULT_MEMBERSHIP_TTL_MILLIS = 15_000

export interface CoordinatorOptions {
  clusterId: string
  totalShards: number
  /** How long a cluster stays a member without a heartbeat. Default 15s. */
  membershipTtlMillis?: number
  /** Lease TTL; must satisfy the fencing invariant (see lifecycle). */
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

// Membership (server-time scored) + per-shard leases; leases prevent double-ownership when views diverge.
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
    this.leaseTtlMillis = options.leaseTtlMillis ?? DEFAULT_LEASE_TTL_MILLIS
    this.prefix = options.keyPrefix ?? 'wildbeast'
  }

  private key(...parts: Array<string | number>): string {
    return [this.prefix, ...parts].join(':')
  }

  private async serverTimeMillis(): Promise<number> {
    const [seconds, microseconds] = await this.redis.time()
    return Number(seconds) * 1_000 + Math.floor(Number(microseconds) / 1_000)
  }

  // CHECK: fleet must agree on total or guild routing diverges; first cluster wins.
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

  // False when this cluster no longer holds the lease.
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
