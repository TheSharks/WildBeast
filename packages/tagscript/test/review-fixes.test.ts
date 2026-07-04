import { describe, expect, it } from 'vitest'
import { RenderError, render } from '../src/index.js'

describe('review fixes', () => {
  it('oneline replaces real newlines', async () => {
    expect((await render('{oneline:a\nb}')).output).toBe('a b')
    expect((await render('{oneline:a\r\nb}')).output).toBe('a b')
  })

  it('oneline still replaces literal \\n sequences', async () => {
    expect((await render(String.raw`{oneline:a\nb}`)).output).toBe('a b')
  })

  it('set trims keys like get and delete do', async () => {
    expect((await render('{set: name |Bob}{get: name }')).output).toBe('Bob')
    expect(
      (await render('{set: name |Bob}{delete: name }{get:name}')).output,
    ).toBe('undefined')
  })

  it('uuid returns a valid v4 UUID', async () => {
    const result = await render('{uuid}')
    expect(result.output).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('time replaces repeated format tokens', async () => {
    const result = await render('{time:0|dd/dd}')
    expect(result.output).toBe('01/01')
  })

  it('arg returns undefined for negative index', async () => {
    const result = await render('{arg:-1}', { args: ['a', 'b'] })
    expect(result.output).toBe('undefined')
  })

  it('strict mode includes the tag name in the error', async () => {
    await expect(render('{nope}', { mode: 'strict' })).rejects.toThrow(
      'Unknown tag: nope',
    )
  })

  describe('errors are RenderError instances', () => {
    it('for unknown tags in strict mode', async () => {
      await expect(render('{nope}', { mode: 'strict' })).rejects.toBeInstanceOf(
        RenderError,
      )
    })

    it('for output length limits', async () => {
      await expect(
        render('{range:0|2000}', { maxOutputLength: 10 }),
      ).rejects.toBeInstanceOf(RenderError)
    })

    it('for invalid regex patterns', async () => {
      await expect(
        render('{replaceregex:text|[unclosed|x}'),
      ).rejects.toBeInstanceOf(RenderError)
    })

    it('for parser recursion limits', async () => {
      const input = '{a:'.repeat(1100) + 'x' + '}'.repeat(1100)
      await expect(render(input)).rejects.toBeInstanceOf(RenderError)
    })
  })
})

describe('low-severity fixes', () => {
  it('substring does not swap arguments when start > end', async () => {
    expect((await render('{substring:hello|3|1}')).output).toBe('')
  })

  it('substring supports negative indices', async () => {
    expect((await render('{substring:hello|-3}')).output).toBe('llo')
    expect((await render('{substring:hello|0|-2}')).output).toBe('hel')
  })

  it('empty tag names are literal text in strict mode', async () => {
    expect((await render('{}', { mode: 'strict' })).output).toBe('{}')
    expect((await render('{:}', { mode: 'strict' })).output).toBe('{:}')
    expect((await render('a{}b', { mode: 'strict' })).output).toBe('a{}b')
  })
})
