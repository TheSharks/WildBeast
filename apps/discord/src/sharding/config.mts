export interface ShardingConfig {
  totalShards: number | 'auto'
  shardList: number[] | 'auto'
}

export type ClusteringConfig =
  | ({ mode: 'static' } & ShardingConfig)
  | { mode: 'autonomous'; totalShards: number }

/**
 * `static` (default): this cluster runs a fixed shard range from
 * WILDBEAST_SHARDING_*. `autonomous`: clusters sharing a Redis discover each
 * other and split WILDBEAST_SHARDING_TOTAL shards among themselves,
 * rebalancing automatically as clusters come and go.
 */
export function parseClusteringConfig(
  env: NodeJS.ProcessEnv = process.env,
): ClusteringConfig {
  const mode = env.WILDBEAST_CLUSTERING_MODE ?? 'static'

  if (mode === 'static') {
    return { mode, ...parseShardingConfig(env) }
  }

  if (mode !== 'autonomous') {
    throw new Error(
      `WILDBEAST_CLUSTERING_MODE must be "static" or "autonomous", got "${mode}"`,
    )
  }

  const total = Number.parseInt(env.WILDBEAST_SHARDING_TOTAL ?? '', 10)
  if (!Number.isInteger(total) || total < 1) {
    throw new Error(
      'Autonomous clustering requires WILDBEAST_SHARDING_TOTAL: every cluster in the fleet must agree on a fixed shard total',
    )
  }
  if (env.WILDBEAST_SHARDING_START || env.WILDBEAST_SHARDING_END) {
    throw new Error(
      'WILDBEAST_SHARDING_START/END are static-mode options; autonomous clusters compute their own ranges',
    )
  }

  return { mode, totalShards: total }
}

/**
 * Resolve this cluster's shard assignment from the environment.
 *
 * With none of the WILDBEAST_SHARDING_* variables set, the cluster runs
 * every shard Discord recommends (single-cluster mode). With them set, the
 * cluster runs shards START..END (inclusive) of TOTAL — every cluster in the
 * fleet must agree on TOTAL.
 */
export function parseShardingConfig(
  env: NodeJS.ProcessEnv = process.env,
): ShardingConfig {
  const totalRaw = env.WILDBEAST_SHARDING_TOTAL
  const startRaw = env.WILDBEAST_SHARDING_START
  const endRaw = env.WILDBEAST_SHARDING_END

  if (!totalRaw && !startRaw && !endRaw) {
    return { totalShards: 'auto', shardList: 'auto' }
  }

  const total = Number.parseInt(totalRaw ?? '', 10)
  if (!Number.isInteger(total) || total < 1) {
    throw new Error(
      'WILDBEAST_SHARDING_TOTAL must be a positive integer when shard range variables are set',
    )
  }

  const start = startRaw ? Number.parseInt(startRaw, 10) : 0
  const end = endRaw ? Number.parseInt(endRaw, 10) : total - 1
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start > end ||
    end >= total
  ) {
    throw new Error(
      `Invalid shard range ${startRaw ?? '0'}..${endRaw ?? total - 1} for ${total} total shards`,
    )
  }

  return {
    totalShards: total,
    shardList: Array.from(
      { length: end - start + 1 },
      (_, index) => start + index,
    ),
  }
}
