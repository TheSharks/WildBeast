import { describe, expect, it } from 'vitest'
import { createRegistry, RenderError, render } from '../src/index.js'
import type { Sandbox } from '../src/sandbox/types.js'

describe('recursion limits', () => {
  describe('maxIterations fails closed', () => {
    it('throws when output never converges', async () => {
      const registry = createRegistry({
        grow: async (_ctx, [value]) => `{grow:${value}x}`,
      })
      await expect(
        render('{grow:x}', { registry, maxIterations: 5 }),
      ).rejects.toThrow('Exceeded maximum iterations of 5')
    })

    it('throws a RenderError', async () => {
      const registry = createRegistry({
        grow: async (_ctx, [value]) => `{grow:${value}x}`,
      })
      await expect(
        render('{grow:x}', { registry, maxIterations: 5 }),
      ).rejects.toBeInstanceOf(RenderError)
    })

    it('does not throw when output converges', async () => {
      const result = await render('{upper:hello}', { maxIterations: 2 })
      expect(result.output).toBe('HELLO')
    })
  })

  describe('maxDepth applies inside lazy tags', () => {
    it('throws on deeply nested eval', async () => {
      let template = 'x'
      for (let i = 0; i < 20; i++) {
        template = `{eval:${template}}`
      }
      await expect(render(template, { maxDepth: 5 })).rejects.toThrow(
        'Exceeded maximum depth of 5',
      )
    })

    it('throws on deeply nested if branches', async () => {
      let template = 'x'
      for (let i = 0; i < 20; i++) {
        template = `{if:1|=|1|${template}}`
      }
      await expect(render(template, { maxDepth: 5 })).rejects.toThrow(
        'Exceeded maximum depth of 5',
      )
    })

    it('allows lazy nesting within maxDepth', async () => {
      const result = await render('{eval:{eval:{eval:x}}}', { maxDepth: 10 })
      expect(result.output).toBe('x')
    })
  })

  describe('inert handler output', () => {
    const sandbox = (text: string): Sandbox => ({
      execute: async () => ({ text }),
    })

    it('js output is not re-executed as TagScript by default', async () => {
      const result = await render('{js:code}', {
        enableJs: true,
        sandbox: sandbox('{upper:hi}'),
      })
      expect(result.output).toBe('{upper:hi}')
    })

    it('js output pipes are preserved literally', async () => {
      const result = await render('{js:code}', {
        enableJs: true,
        sandbox: sandbox('a|b'),
      })
      expect(result.output).toBe('a|b')
    })

    it('inertHandlerOutput: [] restores re-execution', async () => {
      const result = await render('{js:code}', {
        enableJs: true,
        sandbox: sandbox('{upper:hi}'),
        inertHandlerOutput: [],
      })
      expect(result.output).toBe('HI')
    })

    it('custom tags can be marked inert', async () => {
      const registry = createRegistry({
        payload: async () => '{upper:hi}',
      })
      const result = await render('{payload}', {
        registry,
        inertHandlerOutput: ['payload'],
      })
      expect(result.output).toBe('{upper:hi}')
    })

    it('variables still re-execute recursively', async () => {
      const result = await render('{get:x}', {
        variables: { x: '{upper:hi}' },
      })
      expect(result.output).toBe('HI')
    })
  })
})
