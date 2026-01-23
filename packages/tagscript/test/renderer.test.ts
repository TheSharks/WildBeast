import { describe, expect, it } from 'vitest'
import { createRegistry, render } from '../src/index.js'

describe('renderer', () => {
  it('accepts Map as variables', async () => {
    const variables = new Map([['foo', 'bar']])
    const result = await render('a{foo}', { variables })
    expect(result.output).toBe('abar')
  })

  it('uses registry tags', async () => {
    const registry = createRegistry({
      upper: async (_ctx, [value]) => value.toUpperCase(),
    })
    const result = await render('a{upper:b}', { registry })
    expect(result.output).toBe('aB')
  })
})
