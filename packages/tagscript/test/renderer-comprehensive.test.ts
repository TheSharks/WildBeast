import { describe, expect, it } from 'vitest'
import { createRegistry, render } from '../src/index.js'
import { parse } from '../src/parser.js'
import { DEFAULT_LIMITS } from '../src/runtime/limits.js'
import { renderAst } from '../src/runtime/renderer.js'

describe('renderer comprehensive', () => {
  describe('lazy tag handling in ignore mode', () => {
    it('returns literal for unknown tag in ignore mode', async () => {
      const result = await render('{unknown:value}', { mode: 'ignore' })
      expect(result.output).toBe('{unknown:value}')
    })
  })

  describe('lazy tag handling in strict mode', () => {
    it('throws on unknown tag in strict mode', async () => {
      await expect(
        render('{unknown:value}', { mode: 'strict' }),
      ).rejects.toThrow('Unknown tag')
    })
  })

  describe('renderAst function', () => {
    it('renders AST with text nodes', async () => {
      const ast = parse('hello world')
      const result = await renderAst(
        ast,
        {
          mode: 'ignore',
          options: {},
          fetchRequests: 0,
          expansions: 0,
          regexOperations: 0,
        },
        DEFAULT_LIMITS,
      )
      expect(result.output).toBe('hello world')
    })

    it('renders AST with tag nodes', async () => {
      const registry = createRegistry({
        upper: async (_ctx, [value]) => value.toUpperCase(),
      })
      const ast = parse('{upper:hello}')
      const result = await renderAst(
        ast,
        {
          mode: 'ignore',
          registry,
          options: {},
          fetchRequests: 0,
          expansions: 0,
          regexOperations: 0,
        },
        DEFAULT_LIMITS,
      )
      expect(result.output).toBe('HELLO')
    })

    it('renders AST with mixed nodes', async () => {
      const registry = createRegistry({
        upper: async (_ctx, [value]) => value.toUpperCase(),
      })
      const ast = parse('hello {upper:world}!')
      const result = await renderAst(
        ast,
        {
          mode: 'ignore',
          registry,
          options: {},
          fetchRequests: 0,
          expansions: 0,
          regexOperations: 0,
        },
        DEFAULT_LIMITS,
      )
      expect(result.output).toBe('hello WORLD!')
    })
  })

  describe('handler output', () => {
    it('is literal and never re-executed', async () => {
      const registry = createRegistry({
        step1: async (_ctx, [value]) => `{step2:${value}}`,
        step2: async (_ctx, [value]) => value,
      })
      const result = await render('{step1:x}', { registry })
      expect(result.output).toBe('{step2:x}')
    })

    it('does not loop when a handler emits its own tag', async () => {
      const registry = createRegistry({
        loop: async (_ctx, [value]) => `{loop:${value}}`,
      })
      const result = await render('{loop:x}', { registry, maxIterations: 5 })
      expect(result.output).toBe('{loop:x}')
    })
  })

  describe('tag argument rendering', () => {
    it('renders nested tags in arguments', async () => {
      const registry = createRegistry({
        uppercase: async (_ctx, [value]) => value.toUpperCase(),
      })
      const result = await render('{uppercase:a}', { registry })
      expect(result.output).toBe('A')
    })

    it('renders deeply nested arguments', async () => {
      const registry = createRegistry({
        id: async (_ctx, [value]) => value,
        outer: async (_ctx, [value]) => value,
      })
      const result = await render('{outer:{id:x}}', { registry })
      expect(result.output).toBe('x')
    })
  })
})
