import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'
import { DEFAULT_LIMITS } from '../src/runtime/limits.js'
import { createRegistry } from '../src/runtime/registry.js'

describe('integration tests', () => {
  describe('limits edge case - iteration limit', () => {
    it('stops re-rendering after max iterations', async () => {
      const registry = createRegistry({
        loop: async () => '{loop:x}',
      })
      const result = await render('{loop:x}', { registry, maxIterations: 2 })
      expect(result.output).toBe('{loop:x}')
    })
  })

  describe('functional tags - unknown operator', () => {
    it('returns empty for unknown operator in if', async () => {
      const result = await render('{if:a|>|b|then|else}')
      expect(result.output).toBe('else')
    })
  })

  describe('js tag without sandbox', () => {
    it('throws error when sandbox not provided', async () => {
      await expect(render('{js:1+1}', { enableJs: false })).rejects.toThrow(
        'JavaScript execution is not enabled',
      )
    })
  })

  describe('discord tags - validation', () => {
    it('handles invalid user tag', async () => {
      const result = await render('{usertag}', {
        discord: { user: { id: '123', tag: 'InvalidTag', mention: '<@123>' } },
      })
      expect(result.output).toBe('InvalidTag')
    })

    it('handles usertag with # but no discriminator', async () => {
      const result = await render('{usertag}', {
        discord: { user: { id: '123', tag: 'User#0000', mention: '<@123>' } },
      })
      expect(result.output).toBe('User#0000')
    })
  })

  describe('registry customizations', () => {
    it('handles custom regular tag', async () => {
      const registry = createRegistry({
        custom: async (_ctx, [value]) => `CUSTOM:${value}`,
      })
      const result = await render('{custom:test}', { registry })
      expect(result.output).toBe('CUSTOM:test')
    })

    it('uses default tags when registry not provided', async () => {
      const result = await render('{upper:hello}')
      expect(result.output).toBe('HELLO')
    })

    it('allows overriding default tags', async () => {
      const registry = createRegistry({
        upper: async (_ctx, [value]) => `OVERRIDE:${value}`,
      })
      const result = await render('{upper:hello}', { registry })
      expect(result.output).toBe('OVERRIDE:hello')
    })
  })

  describe('error recovery', () => {
    it('continues rendering after error in ignore mode', async () => {
      const result = await render('before {unknown:tag} after', {
        mode: 'ignore',
      })
      expect(result.output).toBe('before {unknown:tag} after')
    })
  })

  describe('tag combinations', () => {
    it('handles variable setting and getting in chain', async () => {
      const result = await render('{set:x|value}{get:x}')
      expect(result.output).toBe('value')
    })

    it('handles nested conditional logic', async () => {
      const result = await render('{if:{arg:0}|==|yes|then|else}')
      expect(result.output).toBe('else')
    })

    it('combines string and math operations', async () => {
      const result = await render('{length:{replace:hello world| |}}')
      expect(result.output).toBe('10')
    })
  })
})
