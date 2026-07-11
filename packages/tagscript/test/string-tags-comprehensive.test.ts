import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('string tags comprehensive', () => {
  describe('upper and lower', () => {
    it.each([
      ['upper', '{upper:}', ''],
      ['upper', '{upper}', ''],
      ['lower', '{lower:}', ''],
      ['lower', '{lower}', ''],
    ])('%s handles empty/undefined input', async (tag, input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it.each([
      ['upper', 'HELLO', 'HELLO'],
      ['upper', 'HeLlO WoRlD', 'HELLO WORLD'],
      ['upper', '123', '123'],
      ['upper', 'hello-world!@#', 'HELLO-WORLD!@#'],
      ['lower', 'hello', 'hello'],
      ['lower', 'HeLlO WoRlD', 'hello world'],
      ['lower', 'ABC123', 'abc123'],
    ])('%s transforms %s correctly', async (tag, input, expected) => {
      const result = await render(`{${tag}:${input}}`)
      expect(result.output).toBe(expected)
    })
  })

  describe('length', () => {
    it.each([
      ['{length:}', '0'],
      ['{length}', '0'],
      ['{length:a}', '1'],
      ['{length:hello world}', '11'],
      ['{length:😀😀😀}', '6'],
    ])('%s returns %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('replace', () => {
    it.each([
      ['{replace:|||b}', ''],
      ['{replace}', ''],
      ['{replace:abc|||x}', 'abc'],
      ['{replace:hello world|world|}', 'hello '],
      ['{replace:banana|a|o}', 'bonono'],
      ['{replace:hello-world|-| }', 'hello world'],
      ['{replace:123123|2|9}', '193193'],
      ['{replace:hello|x|y}', 'hello'],
    ])('%s evaluates to %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('replaceregex', () => {
    it.each([
      ['{replaceregex:hello world|/o/g|a}', 'hella warld'],
      ['{replaceregex:Hello World|/h/gi|y}', 'yello World'],
      ['{replaceregex:hello world|/o/|a}', 'hella world'],
    ])('TagScript syntax: %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it.each([
      [
        '{replaceregex:\\d|with:#|in:I have 5 cats and 23 shirts}',
        'I have # cats and ## shirts',
      ],
      [
        '{replaceregex:/\\d+/gi|with:X|in:I have 5 cats and 23 shirts}',
        'I have X cats and X shirts',
      ],
      // With only one JagTag marker present, the arguments read as native
      // syntax: text "\d", pattern "with:#", no replacement.
      ['{replaceregex:\\d|with:#}', '\\d'],
    ])('JagTag syntax: %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it('handles invalid regex gracefully', async () => {
      await expect(render('{replaceregex:hello|/(/|x}')).rejects.toThrow()
    })
  })

  describe('reverse', () => {
    it.each([
      ['{reverse:}', ''],
      ['{reverse}', ''],
      ['{reverse:a}', 'a'],
      ['{reverse:hello}', 'olleh'],
      ['{reverse:hello world}', 'dlrow olleh'],
      ['{reverse:12345}', '54321'],
      ['{reverse:abc123}', '321cba'],
    ])('%s returns %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })

    it('should correctly reverse grapheme clusters (emojis)', async () => {
      expect((await render('{reverse:👋}')).output).toBe('👋')

      const family = '👨‍👩‍👧‍👦'
      expect((await render(`{reverse:${family}}`)).output).toBe(family)

      const input = 'a👨‍👩‍👧‍👦b'
      expect((await render(`{reverse:${input}}`)).output).toBe('b👨‍👩‍👧‍👦a')
    })
  })

  describe('url, oneline, hash', () => {
    it.each([
      ['url', '{url:hello world}', 'hello%20world'],
      ['oneline', '{oneline:hello\\nworld}', 'hello world'],
      ['hash', '{hash:hello}', '99162322'],
    ])('%s: %s', async (tag, input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })

  describe('substring', () => {
    it.each([
      ['{substring:hello|1}', 'ello'],
      ['{substring:hello|1|3}', 'el'],
      ['{substring:hello|0|3}', 'hel'],
      ['{substring:hello world|6}', 'world'],
    ])('%s returns %s', async (input, expected) => {
      const result = await render(input)
      expect(result.output).toBe(expected)
    })
  })
})
