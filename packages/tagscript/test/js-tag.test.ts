import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('js tag', () => {
  it('requires enableJs', async () => {
    await expect(render('{js:1+1}')).rejects.toThrow()
  })

  it('delegates to sandbox', async () => {
    const result = await render('{js:1+1}', {
      enableJs: true,
      sandbox: {
        async execute(code) {
          return code === '1+1' ? { text: '2' } : { text: '0' }
        },
      },
    })
    expect(result.output).toBe('2')
  })
})
