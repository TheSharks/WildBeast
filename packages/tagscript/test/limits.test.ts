import { describe, expect, it } from 'vitest'
import { createRegistry, render } from '../src/index.js'
import { renderSegment } from '../src/runtime/renderer.js'
import type { RenderContext, Segment } from '../src/types.js'

describe('limits', () => {
  it('stops after maxIterations', async () => {
    const registry = createRegistry({
      echo: async (_ctx, [value]) => `{echo:${value}}`,
    })
    const result = await render('{echo:x}', { registry, maxIterations: 1 })
    expect(result.output).toBe('{echo:x}')
  })

  it('throws when output exceeds maxOutputLength', async () => {
    const registry = createRegistry({
      large: async () => 'x'.repeat(1000),
    })
    await expect(
      render('{large}', { registry, maxOutputLength: 500 }),
    ).rejects.toThrow('Output exceeded maximum length of 500 characters')
  })

  it('throws when tag nesting exceeds maxDepth', async () => {
    const registry = createRegistry({
      outer: async (_ctx, [value]) => value,
      inner: async (_ctx, [value]) => value,
      deep: async (_ctx, [value]) => value,
      id: async (_ctx, [value]) => value,
    })
    await expect(
      render('{outer:{inner:{deep:{id:x}}}}', { registry, maxDepth: 2 }),
    ).rejects.toThrow('Exceeded maximum depth of 2')
  })

  it('allows nesting within maxDepth', async () => {
    const registry = createRegistry({
      a: async (_ctx, [value]) => value,
      b: async (_ctx, [value]) => value,
      c: async (_ctx, [value]) => value,
      id: async (_ctx, [value]) => value,
    })
    const result = await render('{a:{b:{c:{id:x}}}}', { registry, maxDepth: 4 })
    expect(result.output).toBe('x')
  })

  it('should stop processing before stack overflow', async () => {
    // Manually construct a deep AST to bypass parser recursion limits
    // We want to test the RENDERER recursion limit
    const depth = 5000
    let current: Segment = {
      nodes: [{ type: 'text', value: 'x', span: { start: 0, end: 1 } }],
    }

    for (let i = 0; i < depth; i++) {
      current = {
        nodes: [
          {
            type: 'tag',
            name: 'a',
            args: [current],
            span: { start: 0, end: 0 },
          },
        ],
      }
    }

    const registry = createRegistry({
      a: async (_ctx, args) => args[0],
    })

    const limits = {
      maxIterations: 100,
      maxOutputLength: 100000,
      maxDepth: 100,
      regexPatternLength: 1000,
      maxRegexInputLength: 10000,
      maxFetchRequests: 3,
    }
    const context: RenderContext = {
      registry,
      options: {},
      mode: 'strict',
      fetchRequests: 0,
      variables: new Map(),
    }

    // We are testing renderSegment directly to bypass the parser AND serializer
    await expect(
      renderSegment(current, context, '', limits, 0),
    ).rejects.toThrow(/Exceeded maximum depth/)
  })
})
