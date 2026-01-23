import { describe, expect, it } from 'vitest'
import { render } from '../src/index.js'

describe('tagscript smoke', () => {
  it('renders plain text', async () => {
    const result = await render('hello')
    expect(result.output).toBe('hello')
  })
})
