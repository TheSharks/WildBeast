import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'
import type { RenderOptions } from '../src/types.js'

describe('replaceregex limits', () => {
  describe('limit compliance', () => {
    it('throws when pattern exceeds length limit', async () => {
      const longPattern = '/a'.repeat(60) + '/'

      await expect(
        render(`{replaceregex:test string|${longPattern}|replacement}`, {
          regexPatternLength: 10,
        } as RenderOptions),
      ).rejects.toThrow('Regex pattern too long')
    })

    it('accepts pattern at the length limit', async () => {
      const patternStr = '/a{1}/'

      const result = await render(`{replaceregex:aaaa|${patternStr}|x}`, {
        regexPatternLength: 6,
      } as RenderOptions)

      expect(result.output).toBe('xaaa')
    })

    it('throws when JagTag syntax pattern exceeds limit', async () => {
      await expect(
        render(`{replaceregex:/a${'b'.repeat(100)}/|with:x|in:test}`, {
          regexPatternLength: 50,
        } as RenderOptions),
      ).rejects.toThrow('Regex pattern too long')
    })
  })

  describe('basic functionality', () => {
    it('replaces with slash-delimited pattern and flags', async () => {
      const result = await render(
        '{replaceregex:Hello World hello|/hello/gi|Hi}',
      )
      expect(result.output).toBe('Hi World Hi')
    })

    it('treats undelimited patterns as global regex', async () => {
      const result = await render('{replaceregex:test string test|test|TEST}')
      expect(result.output).toBe('TEST string TEST')
    })

    it('does not replace without global flag for delimited pattern', async () => {
      const result = await render('{replaceregex:test test test|/test/|X}')
      expect(result.output).toBe('X test test')
    })

    it('supports capture groups in replacement', async () => {
      const result = await render('{replaceregex:a1 a2 a3|/a(\\d)/|b$1}')
      expect(result.output).toBe('b1 a2 a3')
    })

    it('handles escaped slashes in delimited patterns', async () => {
      const result = await render('{replaceregex:a/b a/b|/a\\/b/g|x}')
      expect(result.output).toBe('x x')
    })

    it('returns original text if pattern is empty', async () => {
      const result = await render('{replaceregex:test string||replacement}')
      expect(result.output).toBe('test string')
    })

    it('returns original text if text is empty', async () => {
      const result = await render('{replaceregex:|/test/|replacement}')
      expect(result.output).toBe('')
    })

    it('treats undefined replacement as empty string', async () => {
      const result = await render('{replaceregex:test string test|/test/g|}')
      expect(result.output).toBe(' string ')
    })

    it('supports JagTag syntax with pattern|with:replacement|in:text', async () => {
      const result = await render(
        '{replaceregex:\\d|with:#|in:I have 5 cats and 23 shirts}',
      )
      expect(result.output).toBe('I have # cats and ## shirts')
    })

    it('supports JagTag syntax with regex flags', async () => {
      const result = await render(
        '{replaceregex:/\\d+/gi|with:X|in:I have 5 cats and 23 shirts}',
      )
      expect(result.output).toBe('I have X cats and X shirts')
    })
  })

  describe('error handling', () => {
    it('wraps invalid regex compilation errors', async () => {
      await expect(
        render('{replaceregex:test|/[invalid(/|replacement}'),
      ).rejects.toThrow(/^Invalid regex:/)
    })

    it('includes original error message in wrapper', async () => {
      await expect(
        render('{replaceregex:test|/[ /|replacement}'),
      ).rejects.toThrow(/Invalid regex:.*unterminated/i)
    })
  })

  describe('ReDoS protection', () => {
    it('rejects vulnerable regex patterns', async () => {
      // Classic ReDoS pattern: nested quantifiers with overlapping alternatives
      await expect(
        render('{replaceregex:aaaaaaaaaa|/^(a+)+$/|x}'),
      ).rejects.toThrow('Potentially unsafe regex pattern')
    })

    it('rejects vulnerable patterns in JagTag syntax', async () => {
      await expect(
        render('{replaceregex:^(a+)+$|with:x|in:aaaa}'),
      ).rejects.toThrow('Potentially unsafe regex pattern')
    })

    it('allows safe regex patterns', async () => {
      const result = await render('{replaceregex:hello world|/\\w+/g|X}')
      expect(result.output).toBe('X X')
    })

    it('throws when input text exceeds maxRegexInputLength', async () => {
      const longInput = 'a'.repeat(200)
      await expect(
        render(`{replaceregex:${longInput}|/a/g|b}`, {
          maxRegexInputLength: 100,
        } as RenderOptions),
      ).rejects.toThrow('Input text too long for regex operation')
    })

    it('accepts input text at the length limit', async () => {
      const input = 'a'.repeat(100)
      const result = await render(`{replaceregex:${input}|/a/g|b}`, {
        maxRegexInputLength: 100,
      } as RenderOptions)
      expect(result.output).toBe('b'.repeat(100))
    })
  })
})
