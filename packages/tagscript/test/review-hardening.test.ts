import { describe, expect, it } from 'vitest'
import {
  createDefaultRegistry,
  DEFAULT_LIMITS,
  defaultRegistry,
  render,
  renderSegment,
  serializeSegment,
} from '../src/index.js'
import { parse } from '../src/parser.js'
import type { Sandbox } from '../src/sandbox/types.js'

describe('review hardening', () => {
  describe('parser complexity', () => {
    it('parses unclosed nested tags in bounded time', () => {
      // The old parser reparsed the same suffix once per nesting level,
      // taking seconds at ~80 characters. This input is an order of
      // magnitude larger and must stay fast.
      const input = '{a:'.repeat(300)
      const startedAt = performance.now()
      const ast = parse(input)
      expect(performance.now() - startedAt).toBeLessThan(200)
      expect(ast.nodes.length).toBeGreaterThan(0)
    })

    it('bounds pathological unclosed nesting with a work budget', () => {
      const input = '{a:'.repeat(900) + '}'
      const startedAt = performance.now()
      expect(() => parse(input)).toThrow('Template too complex to parse')
      expect(performance.now() - startedAt).toBeLessThan(1000)
    })

    it('parses deep closed nesting quickly', () => {
      const depth = 900
      const input = '{a:'.repeat(depth) + 'x' + '}'.repeat(depth)
      const startedAt = performance.now()
      const ast = parse(input)
      expect(performance.now() - startedAt).toBeLessThan(200)
      expect(ast.nodes).toHaveLength(1)
    })
  })

  describe('range forward progress', () => {
    it('returns empty for unsafe integer bounds', async () => {
      const result = await render('{range:9007199254740992|9007199254740994}')
      expect(result.output).toBe('')
    })

    it('still renders normal ranges', async () => {
      const result = await render('{range:1|5}')
      expect(result.output).toBe('1 2 3 4')
    })
  })

  describe('intermediate output budgeting', () => {
    it('stops nested doubling before it amplifies', async () => {
      // Each {replace} doubles its input; 40 levels would target ~16 TiB.
      // The per-handler check throws at the first oversized intermediate.
      let template = 'x'.repeat(16)
      for (let i = 0; i < 40; i++) {
        template = `{replace:${template}|x|xx}`
      }
      await expect(render(template, { maxOutputLength: 1000 })).rejects.toThrow(
        'Output exceeded maximum length',
      )
    })
  })

  describe('fuzzy comparison', () => {
    it('matches close long operands without a full matrix', async () => {
      const a = 'a'.repeat(3000)
      const b = `${'a'.repeat(2999)}b`
      const startedAt = performance.now()
      const result = await render(`{if:${a}|~|${b}|close|far}`)
      expect(result.output).toBe('close')
      expect(performance.now() - startedAt).toBeLessThan(300)
    })

    it('rejects distant long operands quickly', async () => {
      const a = 'a'.repeat(3000)
      const b = 'b'.repeat(3000)
      const startedAt = performance.now()
      const result = await render(`{if:${a}|~|${b}|close|far}`)
      expect(result.output).toBe('far')
      expect(performance.now() - startedAt).toBeLessThan(300)
    })
  })

  describe('lower-trust data stays literal', () => {
    it('does not execute tags smuggled through {arg}', async () => {
      const result = await render('{arg:0}', { args: ['{range:1|2000}'] })
      expect(result.output).toBe('{range:1|2000}')
    })

    it('does not execute tags smuggled through {args}', async () => {
      const result = await render('{args}', { args: ['{js:process}'] })
      expect(result.output).toBe('{js:process}')
    })

    it('does not execute tags smuggled through discord context', async () => {
      const result = await render('{server}', {
        discord: { server: '{upper:pwn}' },
      })
      expect(result.output).toBe('{upper:pwn}')
    })

    it('does not execute tags smuggled through {set} round-trips', async () => {
      const result = await render('{set:x|{arg:0}}{get:x}', {
        args: ['{js:1+1}'],
      })
      expect(result.output).toBe('{js:1+1}')
    })

    it('lets a template author opt in through {eval}', async () => {
      const result = await render('{eval:{arg:0}}', {
        args: ['{upper:allowed}'],
      })
      expect(result.output).toBe('ALLOWED')
    })
  })

  describe('unicode passthrough', () => {
    it('preserves private-use codepoints in input and output', async () => {
      // The old renderer used U+E000..U+E002 as internal sentinels and
      // rewrote them to {, }, | at the end, corrupting valid input.
      const input = 'abcd'
      const result = await render(`{lower:${input}}`)
      expect(result.output).toBe(input)
    })
  })

  describe('avatar tag', () => {
    it('prefers the complete avatar URL from the embedder', async () => {
      const result = await render('{avatar}', {
        discord: {
          user: {
            id: '123',
            tag: 'user#0',
            mention: '<@123>',
            avatarUrl: 'https://cdn.discordapp.com/avatars/123/abcdef.webp',
          },
        },
      })
      expect(result.output).toBe(
        'https://cdn.discordapp.com/avatars/123/abcdef.webp',
      )
    })
  })

  describe('registry prototype isolation', () => {
    it.each(['toString', '__proto__', 'hasOwnProperty', 'constructor'])(
      'treats {%s} as an unknown tag',
      async (name) => {
        const result = await render(`{${name}}`)
        expect(result.output).toBe(`{${name}}`)
      },
    )

    it('throws Unknown tag in strict mode for prototype names', async () => {
      await expect(render('{toString}', { mode: 'strict' })).rejects.toThrow(
        'Unknown tag: toString',
      )
    })
  })

  describe('tagStore', () => {
    it('renders stored tag contents as a template', async () => {
      const tagStore = {
        getTagContents: (name: string) =>
          name === 'greet' ? 'Hello {upper:{args}}' : undefined,
      }
      const result = await render('{greet}', { tagStore, args: ['world'] })
      expect(result.output).toBe('Hello WORLD')
    })

    it('registered handlers take precedence over the store', async () => {
      const tagStore = {
        getTagContents: () => 'stored',
      }
      const result = await render('{upper:hi}', { tagStore })
      expect(result.output).toBe('HI')
    })

    it('variables take precedence over the store', async () => {
      const tagStore = {
        getTagContents: () => 'stored',
      }
      const result = await render('{x}', {
        tagStore,
        variables: { x: 'variable' },
      })
      expect(result.output).toBe('variable')
    })

    it('names missing from the store stay literal', async () => {
      const tagStore = {
        getTagContents: () => undefined,
      }
      const result = await render('{missing}', { tagStore })
      expect(result.output).toBe('{missing}')
    })
  })

  describe('sandbox attachments', () => {
    it('surfaces the sandbox attachment on RenderResult', async () => {
      const attachment = { data: new Uint8Array([1, 2, 3]), type: 'image/png' }
      const sandbox: Sandbox = {
        execute: async () => ({ text: 'done', attachment }),
      }
      const result = await render('{js:make()}', { enableJs: true, sandbox })
      expect(result.output).toBe('done')
      expect(result.attachment).toBe(attachment)
    })

    it('omits the attachment when the sandbox produces none', async () => {
      const sandbox: Sandbox = {
        execute: async () => ({ text: 'plain' }),
      }
      const result = await render('{js:code}', { enableJs: true, sandbox })
      expect(result.attachment).toBeUndefined()
    })
  })

  describe('registry instances', () => {
    it('createDefaultRegistry returns independent instances', () => {
      expect(createDefaultRegistry()).not.toBe(createDefaultRegistry())
      expect(createDefaultRegistry()).not.toBe(defaultRegistry)
    })
  })

  describe('limit validation', () => {
    it('rejects NaN limits', async () => {
      await expect(render('x', { maxDepth: Number.NaN })).rejects.toThrow(
        RangeError,
      )
    })

    it('rejects negative limits', async () => {
      await expect(render('x', { maxOutputLength: -1 })).rejects.toThrow(
        'Invalid limit',
      )
    })
  })

  describe('regex operation budget', () => {
    it('throws when a template exceeds maxRegexOperations', async () => {
      const template = '{if:a|?|a|y|n}'.repeat(3)
      await expect(render(template, { maxRegexOperations: 2 })).rejects.toThrow(
        'Exceeded maximum regex operations of 2',
      )
    })

    it('counts replaceregex against the same budget', async () => {
      const template = '{replaceregex:aaa|a|b}'.repeat(2)
      await expect(render(template, { maxRegexOperations: 1 })).rejects.toThrow(
        'Exceeded maximum regex operations of 1',
      )
    })
  })

  describe('math exponentiation', () => {
    it('is right-associative', async () => {
      const result = await render('{math:2|^|3|^|2}')
      expect(result.output).toBe('512')
    })
  })

  describe('error contract', () => {
    it('tolerates out-of-range timestamps', async () => {
      const result = await render('{time:99999999999999999999|iso}')
      expect(result.output).toBe('')
    })

    it('{if} with no arguments renders the empty string', async () => {
      const result = await render('{if}')
      expect(result.output).toBe('')
    })

    it('{eval} with no arguments renders the empty string', async () => {
      const result = await render('{eval}')
      expect(result.output).toBe('')
    })
  })

  describe('public exports', () => {
    it('exposes helper values for custom tags', () => {
      expect(DEFAULT_LIMITS.maxOutputLength).toBeGreaterThan(0)
      expect(renderSegment).toBeTypeOf('function')
      expect(serializeSegment).toBeTypeOf('function')
    })
  })
})
