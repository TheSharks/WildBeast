import { describe, expect, it } from 'vitest'
import { parse } from '../src/index.js'

describe('AST', () => {
  it('captures spans for text and tags', () => {
    const ast = parse('a{upper:b}c')
    expect(ast.nodes[0]).toMatchObject({
      type: 'text',
      value: 'a',
      span: { start: 0, end: 1 },
    })
    expect(ast.nodes[1]).toMatchObject({
      type: 'tag',
      name: 'upper',
      span: { start: 1, end: 10 },
    })
  })

  it('parses tag args as segments', () => {
    const ast = parse('{replace:a|b|c}')
    const tag = ast.nodes[0]
    if (tag?.type !== 'tag') {
      throw new Error('expected tag node')
    }

    expect(tag).toMatchObject({ name: 'replace', span: { start: 0, end: 15 } })
    expect(tag.args).toHaveLength(3)
    expect(tag.args[0]).toMatchObject({
      nodes: [{ type: 'text', value: 'a', span: { start: 9, end: 10 } }],
    })
    expect(tag.args[1]).toMatchObject({
      nodes: [{ type: 'text', value: 'b', span: { start: 11, end: 12 } }],
    })
    expect(tag.args[2]).toMatchObject({
      nodes: [{ type: 'text', value: 'c', span: { start: 13, end: 14 } }],
    })
  })
})
