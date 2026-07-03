import { describe, expect, it } from 'vitest'
import {
  assignShards,
  shardOwner,
  shardsFor,
} from '../src/sharding/assignment.mjs'

const TOTAL = 32

describe('rendezvous shard assignment', () => {
  it('is deterministic regardless of member order', () => {
    const forward = assignShards(['a', 'b', 'c'], TOTAL)
    const backward = assignShards(['c', 'a', 'b'], TOTAL)
    expect([...forward.entries()]).toEqual([...backward.entries()])
  })

  it('assigns every shard to exactly one live member', () => {
    const members = ['cluster-0', 'cluster-1', 'cluster-2']
    const assignment = assignShards(members, TOTAL)

    expect(assignment.size).toBe(TOTAL)
    for (const owner of assignment.values()) {
      expect(members).toContain(owner)
    }

    const perMember = members.flatMap((member) =>
      shardsFor(member, members, TOTAL),
    )
    expect(perMember.sort((x, y) => x - y)).toEqual(
      Array.from({ length: TOTAL }, (_, index) => index),
    )
  })

  it('gives a lone member everything', () => {
    expect(shardsFor('only', ['only'], 4)).toEqual([0, 1, 2, 3])
  })

  it('spreads shards across members reasonably', () => {
    const members = ['cluster-0', 'cluster-1', 'cluster-2', 'cluster-3']
    for (const member of members) {
      const owned = shardsFor(member, members, 128)
      // Perfect split would be 32; rendezvous hashing should stay in the
      // same ballpark rather than starving a member.
      expect(owned.length).toBeGreaterThan(10)
      expect(owned.length).toBeLessThan(60)
    }
  })

  it('only moves shards onto a joining member', () => {
    const before = assignShards(['a', 'b'], TOTAL)
    const after = assignShards(['a', 'b', 'c'], TOTAL)

    for (let shardId = 0; shardId < TOTAL; shardId++) {
      if (after.get(shardId) !== before.get(shardId)) {
        expect(after.get(shardId)).toBe('c')
      }
    }
  })

  it('only moves shards owned by a leaving member', () => {
    const before = assignShards(['a', 'b', 'c'], TOTAL)
    const after = assignShards(['a', 'b'], TOTAL)

    for (let shardId = 0; shardId < TOTAL; shardId++) {
      if (before.get(shardId) !== 'c') {
        expect(after.get(shardId)).toBe(before.get(shardId))
      }
    }
  })

  it('rejects an empty member list', () => {
    expect(() => shardOwner(0, [])).toThrow(/without cluster members/)
  })
})
