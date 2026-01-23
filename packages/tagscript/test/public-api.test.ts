import { describe, expect, it } from 'vitest'
import { createDefaultRegistry, render } from '../src/index.js'

describe('public api', () => {
  it('exposes default registry', async () => {
    const registry = createDefaultRegistry()
    const result = await render('{upper:hi}', { registry })
    expect(result.output).toBe('HI')
  })
})
