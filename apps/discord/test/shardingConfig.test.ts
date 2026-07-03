import { describe, expect, it } from 'vitest'
import {
  parseClusteringConfig,
  parseShardingConfig,
} from '../src/sharding/config.mjs'

describe('parseShardingConfig', () => {
  it('defaults to auto when no sharding variables are set', () => {
    expect(parseShardingConfig({})).toEqual({
      totalShards: 'auto',
      shardList: 'auto',
    })
  })

  it('resolves an explicit shard range', () => {
    expect(
      parseShardingConfig({
        WILDBEAST_SHARDING_START: '2',
        WILDBEAST_SHARDING_END: '5',
        WILDBEAST_SHARDING_TOTAL: '8',
      }),
    ).toEqual({
      totalShards: 8,
      shardList: [2, 3, 4, 5],
    })
  })

  it('defaults the range to all shards when only TOTAL is set', () => {
    expect(parseShardingConfig({ WILDBEAST_SHARDING_TOTAL: '3' })).toEqual({
      totalShards: 3,
      shardList: [0, 1, 2],
    })
  })

  it('requires TOTAL when a range is given', () => {
    expect(() =>
      parseShardingConfig({
        WILDBEAST_SHARDING_START: '0',
        WILDBEAST_SHARDING_END: '1',
      }),
    ).toThrow(/WILDBEAST_SHARDING_TOTAL/)
  })

  it('rejects ranges outside the total', () => {
    expect(() =>
      parseShardingConfig({
        WILDBEAST_SHARDING_START: '0',
        WILDBEAST_SHARDING_END: '4',
        WILDBEAST_SHARDING_TOTAL: '4',
      }),
    ).toThrow(/Invalid shard range/)
  })

  it('rejects inverted ranges', () => {
    expect(() =>
      parseShardingConfig({
        WILDBEAST_SHARDING_START: '3',
        WILDBEAST_SHARDING_END: '1',
        WILDBEAST_SHARDING_TOTAL: '4',
      }),
    ).toThrow(/Invalid shard range/)
  })

  it('rejects a non-numeric total', () => {
    expect(() =>
      parseShardingConfig({ WILDBEAST_SHARDING_TOTAL: 'many' }),
    ).toThrow(/WILDBEAST_SHARDING_TOTAL/)
  })
})

describe('parseClusteringConfig', () => {
  it('defaults to static mode with the sharding config embedded', () => {
    expect(parseClusteringConfig({ WILDBEAST_SHARDING_TOTAL: '4' })).toEqual({
      mode: 'static',
      totalShards: 4,
      shardList: [0, 1, 2, 3],
    })
  })

  it('parses autonomous mode', () => {
    expect(
      parseClusteringConfig({
        WILDBEAST_CLUSTERING_MODE: 'autonomous',
        WILDBEAST_SHARDING_TOTAL: '8',
      }),
    ).toEqual({ mode: 'autonomous', totalShards: 8 })
  })

  it('requires a fixed total in autonomous mode', () => {
    expect(() =>
      parseClusteringConfig({ WILDBEAST_CLUSTERING_MODE: 'autonomous' }),
    ).toThrow(/WILDBEAST_SHARDING_TOTAL/)
  })

  it('rejects static range variables in autonomous mode', () => {
    expect(() =>
      parseClusteringConfig({
        WILDBEAST_CLUSTERING_MODE: 'autonomous',
        WILDBEAST_SHARDING_TOTAL: '8',
        WILDBEAST_SHARDING_START: '0',
      }),
    ).toThrow(/static-mode options/)
  })

  it('rejects unknown modes', () => {
    expect(() =>
      parseClusteringConfig({ WILDBEAST_CLUSTERING_MODE: 'chaotic' }),
    ).toThrow(/static.*autonomous/)
  })
})
