import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('functional tags comprehensive', () => {
  describe('if', () => {
    it.each([
      ['{if:abc|==|abc|then|else}', 'then'],
      ['{if:abc|=|abc|then|else}', 'then'],
      ['{if:abc|==|xyz|then|else}', 'else'],
      ['{if:abc|!=|xyz|then|else}', 'then'],
      ['{if:abc|!=|abc|then|else}', 'else'],
      ['{if:abc|!==|xyz|then|else}', 'then'],
      ['{if:abc|!==|abc|then|else}', 'else'],
    ])('%s evaluates to %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it.each([
      ['{if:abc|==|xyz|then}', ''],
      ['{if:abc|==|xyz||else}', 'else'],
      ['{if:abc|==|abc||}', ''],
      ['{if:abc|==|abc|then}', 'then'],
      ['{if:abc|>|abc|then|else}', 'else'],
      ['{if:|==|abc|then|else}', 'else'],
      ['{if:abc|==||then|else}', 'else'],
    ])('edge cases: %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it.each([
      ['{if:{upper:abc}|==|ABC|then|else}', 'then', 'condition'],
      ['{if:abc|==|abc|{upper:hello}|{upper:world}}', 'HELLO', 'then branch'],
      ['{if:abc|==|xyz|{upper:hello}|{upper:world}}', 'WORLD', 'else branch'],
      ['{if:abc| == |abc|then|else}', 'then', 'operator with whitespace'],
    ])('evaluates tags in %s: %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('note', () => {
    it.each([
      ['{note:some content}', ''],
      ['{note}', ''],
      ['{note:{upper:hello}}', ''],
    ])('%s returns empty', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('ignore', () => {
    // {ignore} output is literal: its body is never executed, even when it
    // contains registered tags.
    it.each([
      ['{ignore:{upper:hello}}', '{upper:hello}'],
      ['{ignore:{upper:hello}|{lower:WORLD}}', '{upper:hello}{lower:WORLD}'],
      ['{ignore}', ''],
      ['{ignore:text {upper:tag} more}', 'text {upper:tag} more'],
      ['{ignore:{nested:{inner:value}}}', '{nested:{inner:value}}'],
      ['{ignore:a|b|c}', 'abc'],
    ])('%s evaluates to %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('eval', () => {
    it.each([
      ['{eval:{upper:hello}}', 'HELLO'],
      ['{eval:{upper:{length:hello world}}}', '11'],
      ['{eval:hello}', 'hello'],
      ['{eval:{set:x|{upper:value}}{get:x}}', 'VALUE'],
      ['{eval:  hello  }', '  hello  '],
    ])('%s evaluates to %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('tag combinations', () => {
    it.each([
      ['{if:abc|==|abc|{note:ignored}|else}', ''],
      ['{if:abc|==|abc|{ignore:{upper:hello}}|else}', '{upper:hello}'],
      ['{eval:{if:abc|==|abc|hello|world}}', 'hello'],
      ['{if:abc|==|abc|{if:123|==|123|nested|no}|else}', 'nested'],
    ])('%s evaluates to %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })
})
