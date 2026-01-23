import { describe, expect, it } from 'vitest'
import { createRegistry, render } from '../src/index.js'

describe('edge cases', () => {
  describe('malformed input', () => {
    it.each([
      ['', ''],
      ['hello world', 'hello world'],
      ['{{upper:hi', '{{upper:hi'],
      ['{}', '{}'],
      ['{upper}', ''],
      ['{upper:}', ''],
      ['{replace:a|||b}', 'a'],
    ])('%s returns %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it.each([
      ['hello\\{world\\}', 'hello{world}'],
      ['a\\|b\\|c', 'a|b|c'],
      ['a\\{b}c', 'a{b}c'],
    ])('handles escapes: %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('boundary conditions', () => {
    it('handles very long input', async () => {
      const longText = 'a'.repeat(10000)
      const result = await render(longText)
      expect(result.output).toBe(longText)
    })

    it('handles deeply nested tags', async () => {
      const registry = createRegistry({
        a: async (_ctx, [value]) => value,
        b: async (_ctx, [value]) => value,
        c: async (_ctx, [value]) => value,
        d: async (_ctx, [value]) => value,
        e: async (_ctx, [value]) => value,
        f: async (_ctx, [value]) => value,
        id: async (_ctx, [value]) => value,
      })
      const deep = '{a:{b:{c:{d:{e:{f:{id:x}}}}}}}'
      const result = await render(deep, { registry, maxDepth: 10 })
      expect(result.output).toBe('x')
    })

    it('handles many consecutive tags', async () => {
      const manyTags = '{upper:a}{upper:b}{upper:c}{upper:d}{upper:e}'
      const result = await render(manyTags)
      expect(result.output).toBe('ABCDE')
    })

    it.each([
      ['{upper:émojis 😀}', 'ÉMOJIS 😀'],
      ['{replace:hello!@#$%^&*()|!|?}', 'hello?@#$%^&*()'],
      ['{replace:hello\0world|\0| }', 'hello world'],
    ])('handles special characters: %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('character encodings and escapes', () => {
    it.each([
      ['abc\\\\', 'abc\\'],
      ['a\\\\\\\\b', 'a\\b'],
      ['a\\\\\\\\\\\\{b}', 'a{b}'],
      ['\\\\{hello\\}|\\\\{world\\}', '{hello}|{world}'],
    ])('%s handles backslashes', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('empty strings and whitespace', () => {
    it.each([
      ['{ }', '{ }'],
      ['{upper:  }', '  '],
      ['{replace:a b c| |}', 'abc'],
      ['hello\nworld', 'hello\nworld'],
      ['hello\tworld', 'hello\tworld'],
    ])('%s handles whitespace', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('invalid numbers in math tags', () => {
    it.each([
      ['{abs:notanumber}', 'NaN'],
      ['{sin:notanumber}', 'NaN'],
      ['{abs:Infinity}', 'Infinity'],
      ['{abs:-Infinity}', 'Infinity'],
    ])('%s handles edge values', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })
})
