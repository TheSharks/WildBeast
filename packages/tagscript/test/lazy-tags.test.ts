import { describe, expect, it } from 'vitest'
import { createRegistry, defaultRegistry, render } from '../src/index.js'

describe('lazy tags', () => {
  it('if chooses then branch', async () => {
    const result = await render('{if:1|=|1|yes|no}')
    expect(result.output).toBe('yes')
  })

  it('note returns empty string', async () => {
    const result = await render('a{note:ignored}b')
    expect(result.output).toBe('ab')
  })

  it('ignore keeps raw text', async () => {
    const registry = createRegistry(
      {},
      {
        ignore: defaultRegistry.getLazy?.('ignore')!,
      },
    )
    const result = await render('a{ignore:{upper:x}}b', { registry })
    expect(result.output).toBe('a{upper:x}b')
  })

  it('eval renders nested tags', async () => {
    const registry = createRegistry(
      {
        upper: async (_ctx, [value]) => value.toUpperCase(),
      },
      {
        eval: defaultRegistry.getLazy?.('eval')!,
      },
    )
    const result = await render('{eval:{upper:hi}}', { registry })
    expect(result.output).toBe('HI')
  })

  it('if with missing args returns empty', async () => {
    const result = await render('{if:1|=|1}')
    expect(result.output).toBe('')
  })

  it('nested lazy tags', async () => {
    const registry = createRegistry(
      {
        upper: async (_ctx, [value]) => value.toUpperCase(),
      },
      {
        eval: defaultRegistry.getLazy?.('eval')!,
        if: defaultRegistry.getLazy?.('if')!,
      },
    )
    const result = await render('{if:{eval:{upper:a}}|=|A|yes|no}', {
      registry,
    })
    expect(result.output).toBe('yes')
  })

  it('if with invalid operator defaults to false', async () => {
    const result = await render('{if:1|invalid|1|yes|no}')
    expect(result.output).toBe('no')
  })

  describe('if regex operator ReDoS protection', () => {
    it('rejects vulnerable regex patterns and returns false', async () => {
      // Classic ReDoS pattern - should be detected and return false (else branch)
      const result = await render('{if:aaaa|?|^(a+)+$|yes|no}')
      expect(result.output).toBe('no')
    })

    it('allows safe regex patterns', async () => {
      const result = await render('{if:hello|?|^hello$|yes|no}')
      expect(result.output).toBe('yes')
    })

    it('returns false when input exceeds maxRegexInputLength', async () => {
      const longInput = 'a'.repeat(200)
      const result = await render(`{if:${longInput}|?|a|yes|no}`, {
        maxRegexInputLength: 100,
      })
      expect(result.output).toBe('no')
    })
  })
})
