import type { ShardHost } from '../src/sharding/reconciler.mjs'

/** In-memory ShardHost: shard lifecycle without discord.js. */
export class FakeHost implements ShardHost {
  public readonly shards = new Set<number>()

  public currentShards(): number[] {
    return [...this.shards]
  }

  public isAlive(shardId: number): boolean {
    return this.shards.has(shardId)
  }

  public async start(shardId: number): Promise<void> {
    this.shards.add(shardId)
  }

  public async stop(shardId: number): Promise<void> {
    this.shards.delete(shardId)
  }
}
