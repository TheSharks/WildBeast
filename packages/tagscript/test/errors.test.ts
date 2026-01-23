import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('errors', () => {
  it('strict mode allows literal braces', async () => {
    const result = await render('{not closed', { mode: 'strict' })
    expect(result.output).toBe('{not closed')
  })

  it('strict mode throws on unknown tag', async () => {
    await expect(render('{unknown:1}', { mode: 'strict' })).rejects.toThrow()
  })

  it('ignore mode keeps literal tag', async () => {
    const result = await render('{unknown:1}', { mode: 'ignore' })
    expect(result.output).toBe('{unknown:1}')
  })
})
