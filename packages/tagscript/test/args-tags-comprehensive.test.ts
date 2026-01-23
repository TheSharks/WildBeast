import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('args tags comprehensive', () => {
  describe('args', () => {
    it.each([
      ['{args}', undefined, 'undefined'],
      ['{args}', [], 'undefined'],
      ['{args}', ['hello'], 'hello'],
      ['{args}', ['a', 'b', 'c'], 'a b c'],
      ['{args}', ['hello world', 'foo bar'], 'hello world foo bar'],
    ])('%s with args=%s returns %s', async (input, args, expected) => {
      const result = await render(input, { args })
      expect(result.output).toBe(expected)
    })
  })

  describe('arg', () => {
    it.each([
      ['{arg:0}', undefined, 'undefined'],
      ['{arg:0}', [], 'undefined'],
      ['{arg}', undefined, 'undefined'],
      ['{arg:0}', ['a', 'b', 'c'], 'a'],
      ['{arg:2}', ['a', 'b', 'c'], 'c'],
      ['{arg:10}', ['a', 'b', 'c'], 'undefined'],
      ['{arg:-1}', ['a', 'b', 'c'], 'undefined'],
      ['{arg:abc}', ['a', 'b', 'c'], 'undefined'],
      ['{arg:1.5}', ['a', 'b', 'c'], 'b'],
    ])('%s with args=%s returns %s', async (input, args, expected) => {
      const result = await render(input, { args })
      expect(result.output).toBe(expected)
    })
  })

  describe('argslen', () => {
    it.each([
      ['{argslen}', undefined, '0'],
      ['{argslen}', [], '0'],
      ['{argslen}', ['a'], '1'],
      ['{argslen}', ['a', 'b', 'c', 'd'], '4'],
    ])('%s with args=%s returns %s', async (input, args, expected) => {
      const result = await render(input, { args })
      expect(result.output).toBe(expected)
    })
  })
})
