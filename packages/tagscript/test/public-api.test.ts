import { describe, expect, it } from 'vitest'
import { createDefaultRegistry, defaultRegistry, render } from '../src/index.js'
import {
  createDefaultRegistry as createWebDefaultRegistry,
  render as renderWeb,
} from '../src/web.js'

describe('public api', () => {
  it('exposes default registry', async () => {
    const registry = createDefaultRegistry()
    const result = await render('{upper:hi}', { registry })
    expect(result.output).toBe('HI')
  })

  it('keeps fetch on the Node entrypoint', () => {
    expect(defaultRegistry.getLazy?.('fetch')).toBeTypeOf('function')
  })

  it('exposes a browser-safe web entrypoint', async () => {
    const registry = createWebDefaultRegistry()
    const result = await renderWeb('{upper:{server}}', {
      registry,
      discord: { server: 'WildBeast' },
    })

    expect(result.output).toBe('WILDBEAST')
  })

  it('leaves fetch out of the web default registry', async () => {
    const registry = createWebDefaultRegistry()

    expect(registry.getLazy?.('fetch')).toBeUndefined()
    await expect(
      renderWeb('{fetch:https://example.com}', { mode: 'strict' }),
    ).rejects.toThrow('Unknown tag: fetch')
  })
})
