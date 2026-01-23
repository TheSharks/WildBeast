import { describe, expect, it } from 'vitest'
import { parse } from '../src/index.js'

describe('parser escapes', () => {
  it('parses escaped braces and pipes', () => {
    const input = String.raw`a\{b\|c\}d`
    const ast = parse(input)

    expect(ast.nodes).toHaveLength(1)
    expect(ast.nodes[0]).toMatchObject({
      type: 'text',
      value: 'a{b|c}d',
      span: { start: 0, end: 10 },
    })
  })

  it('treats unterminated tag open brace as text', () => {
    const input = 'a{upper:b'
    const ast = parse(input)

    expect(ast.nodes).toHaveLength(2)
    expect(ast.nodes[0]).toMatchObject({
      type: 'text',
      value: 'a',
      span: { start: 0, end: 1 },
    })
    expect(ast.nodes[1]).toMatchObject({
      type: 'text',
      value: '{upper:b',
      span: { start: 1, end: 9 },
    })
  })

  it('treats top-level pipes as literal text', () => {
    const input = 'a|b'
    const ast = parse(input)

    expect(ast.nodes).toHaveLength(1)
    expect(ast.nodes[0]).toMatchObject({
      type: 'text',
      value: 'a|b',
      span: { start: 0, end: 3 },
    })
  })
})
