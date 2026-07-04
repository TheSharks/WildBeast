import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('math tags comprehensive', () => {
  describe('unary math functions', () => {
    // Test common patterns for all unary functions
    it.each([
      ['abs', '0'],
      ['sin', '0'],
      ['cos', String(Math.cos(0))],
      ['tan', '0'],
      ['sqrt', '0'],
    ])('%s handles undefined arg', async (tag, expected) => {
      const result = await render(`{${tag}}`)
      expect(result.output).toBe(expected)
    })

    it.each([
      'abs',
      'sin',
      'tan',
      'sqrt',
    ])('%s handles empty arg', async (tag) => {
      const result = await render(`{${tag}:}`)
      expect(result.output).toBe('NaN')
    })

    it('cos handles empty arg', async () => {
      const result = await render('{cos:}')
      expect(parseFloat(result.output)).toBeNaN()
    })

    it.each([
      ['abs', '0', '0'],
      ['sin', '0', '0'],
      ['tan', '0', '0'],
      ['sqrt', '0', '0'],
    ])('%s handles zero', async (tag, input, expected) => {
      const result = await render(`{${tag}:${input}}`)
      expect(result.output).toBe(expected)
    })

    it.each([
      ['abs', 'Infinity', 'Infinity'],
      ['abs', '-Infinity', 'Infinity'],
    ])('%s handles %s', async (tag, input, expected) => {
      const result = await render(`{${tag}:${input}}`)
      expect(result.output).toBe(expected)
    })
  })

  describe('abs', () => {
    it.each([
      ['5', '5'],
      ['-5', '5'],
      ['3.14', '3.14'],
      ['-3.14', '3.14'],
      ['0.0001', '0.0001'],
      ['999999', '999999'],
    ])('handles %s', async (input, expected) => {
      const result = await render(`{abs:${input}}`)
      expect(result.output).toBe(expected)
    })
  })

  describe('trigonometric functions', () => {
    it.each([
      ['sin', '1.570796', 1],
      ['sin', '3.14159', 0],
      ['sin', '-1.5708', -1],
      ['cos', '0', 1],
      ['cos', '1.5708', 0],
      ['cos', '3.14159', -1],
      ['tan', '0.7854', 1],
    ])('%s(%s) ≈ %s', async (func, input, expected) => {
      const result = await render(`{${func}:${input}}`)
      expect(parseFloat(result.output)).toBeCloseTo(expected, 2)
    })
  })

  describe('pow', () => {
    it.each([
      ['2|3', '8'],
      ['5|0', '1'],
      ['10|2', '100'],
      ['9|0.5', '3'],
    ])('handles %s', async (input, expected) => {
      const result = await render(`{pow:${input}}`)
      expect(result.output).toBe(expected)
    })
  })

  describe('base', () => {
    it.each([
      ['255|16', 'ff'],
      ['10|2', '1010'],
      ['100|8', '144'],
      ['31|16', '1f'],
      ['100|36', '2s'],
    ])('handles %s', async (input, expected) => {
      const result = await render(`{base:${input}}`)
      expect(result.output).toBe(expected)
    })
  })

  describe('mod', () => {
    it.each([
      ['10|3', '1'],
      ['25|7', '4'],
      ['100|15', '10'],
      ['9|2', '1'],
      ['14|5', '4'],
    ])('handles %s', async (input, expected) => {
      const result = await render(`{mod:${input}}`)
      expect(result.output).toBe(expected)
    })
  })

  describe('random', () => {
    it.each([
      ['{random}', 0, 100],
      ['{random:1|10}', 1, 10],
      ['{random:50|60}', 50, 60],
      ['{random:-10|10}', -10, 10],
    ])('%s generates number in range', async (input, min, max) => {
      const result = await render(input)
      const num = parseInt(result.output, 10)
      expect(num).toBeGreaterThanOrEqual(min)
      expect(num).toBeLessThanOrEqual(max)
    })

    it.each([
      ['{random:10|5}', 'Error: min cannot be greater than max'],
      ['{random:a|b}', ''],
      ['{random:5|b}', ''],
      ['{random:a|10}', ''],
    ])('%s returns error or empty', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('sqrt', () => {
    it.each([
      ['16', '4'],
      ['2.25', '1.5'],
    ])('handles %s', async (input, expected) => {
      const result = await render(`{sqrt:${input}}`)
      expect(result.output).toBe(expected)
    })

    it('handles non-perfect square', async () => {
      const result = await render('{sqrt:2}')
      expect(parseFloat(result.output)).toBeCloseTo(1.414, 3)
    })

    it.each(['-1', '-999'])('returns error for negative %s', async (input) => {
      const result = await render(`{sqrt:${input}}`)
      expect(result.output).toBe(
        'Error: cannot calculate square root of negative number',
      )
    })
  })

  describe('constants', () => {
    it.each([
      ['pi', String(Math.PI)],
      ['e', String(Math.E)],
    ])('%s returns correct value', async (tag, expected) => {
      const result = await render(`{${tag}}`)
      expect(result.output).toBe(expected)
    })
  })

  describe('choose', () => {
    it.each([
      ['{choose}', ''],
      ['{choose:}', ''],
      ['{choose:only}', 'only'],
    ])('%s returns %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it.each([
      ['{choose:a|b|c}', ['a', 'b', 'c']],
      [
        '{choose:option one|option two|option three}',
        ['option one', 'option two', 'option three'],
      ],
      ['{choose:|||}', ['', '', '']],
    ])('%s returns one of the options', async (input, options) => {
      const result = await render(input)
      expect(options).toContain(result.output)
    })

    it('selects every option over many renders', async () => {
      const seen = new Set<string>()
      for (let i = 0; i < 200; i++) {
        seen.add((await render('{choose:a|b|c}')).output)
      }
      expect([...seen].sort()).toEqual(['a', 'b', 'c'])
    })
  })

  describe('range', () => {
    it.each([
      ['{range}', ''],
      ['{range:5}', ''],
      ['{range:5|5}', ''],
      ['{range:5|2}', ''],
    ])('%s returns empty', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it.each([
      ['{range:0|5}', '0 1 2 3 4'],
      ['{range:3|7}', '3 4 5 6'],
      ['{range:0|10|2}', '0 2 4 6 8'],
      ['{range:0|9|3}', '0 3 6'],
      ['{range:1|5}', '1 2 3 4'],
    ])('%s generates sequence', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it.each([
      ['{range:0|10|0}', 'Error: step must be positive'],
      ['{range:0|10|-1}', 'Error: step must be positive'],
      ['{range:0|10|-5}', 'Error: step must be positive'],
    ])('%s returns error', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it('should throw error if range is too large', async () => {
      const result = await render('{range:0|1000000|1}')
      expect(result.output).toContain('Range limit exceeded')
    })
  })

  describe('math', () => {
    it.each([
      ['{math:2|+|2}', '4'],
      ['{math:2|-|2}', '0'],
      ['{math:4|/|2}', '2'],
      ['{math:2|*|2}', '4'],
      ['{math:2|^|2}', '4'],
      ['{math:3|%|2}', '1'],
    ])('%s evaluates to %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it.each([
      ['{math:2|+|2|*|3|/|4}', '3.5'],
      ['{math:{math:2|+|2}|*|3|/|4}', '3'],
    ])('handles complex operations: %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it.each([
      ['{math:hello world|+| world}', 'hello world world'],
      ['{math:hello world|-| world}', 'hello'],
      ['{math:5|*|2|+|hello world|-| world}', '10hello'],
      ['{math:hello world|*| world}', 'hello world* world'],
    ])('handles string operations: %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })
})
