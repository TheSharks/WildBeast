import { describe, expect, it } from 'vitest'
import { parseShardingConfig } from '../src/sharding/config.mjs'

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
