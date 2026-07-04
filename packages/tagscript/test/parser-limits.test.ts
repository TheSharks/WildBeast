import { describe, expect, it } from 'vitest'
import { parse } from '../src/index'

describe('Parser Limits', () => {
  it('should throw error on deep recursion', () => {
    const depth = 2000 // 5000 might be too slow to build string or hit other limits
    // Construct nested tags: {a:{a:{a:{...}}}}
    const input = '{a:'.repeat(depth) + '}'.repeat(depth)

    // We expect it to throw due to max recursion depth, OR stack overflow if we haven't fixed it yet.
    // The goal is to make it throw a controlled error.
    expect(() => parse(input)).toThrow(/recursion/i)
  })
})
