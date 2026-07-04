import { RenderError } from './runtime/errors.js'
import type { Ast, Segment, Span, TagNode, TextNode } from './types.js'

const ESCAPE_MAP: Record<string, string> = {
  '{': '{',
  '}': '}',
  '|': '|',
  '\\': '\\',
}

export function parse(input: string): Ast {
  return parseSegment(input, 0, { endOn: null, depth: 0 }).segment
}

type SegmentResult = { segment: Segment; index: number }
type ParseOptions = { endOn: '}' | ':' | '|' | null; depth: number }

function parseSegment(
  input: string,
  startIndex: number,
  options: ParseOptions,
): SegmentResult {
  const nodes: Segment['nodes'] = []
  let textBuffer = ''
  let textStart = startIndex
  let index = startIndex

  const flushText = (endIndex: number) => {
    if (textBuffer.length === 0) return
    nodes.push({
      type: 'text',
      value: textBuffer,
      span: { start: textStart, end: endIndex },
    })
    textBuffer = ''
  }

  while (index < input.length) {
    const char = input[index]

    if (char === '\\') {
      const next = input[index + 1]
      if (next && ESCAPE_MAP[next]) {
        if (textBuffer.length === 0) textStart = index
        textBuffer += ESCAPE_MAP[next]
        index += 2
        continue
      }
    }

    if (
      options.endOn &&
      (char === options.endOn || (options.endOn === '|' && char === '}'))
    ) {
      flushText(index)
      return { segment: { nodes }, index }
    }

    if (char === '{') {
      flushText(index)
      const tagResult = parseTag(input, index, options.depth + 1)
      if (!tagResult.closed) {
        if (textBuffer.length === 0) textStart = index
        textBuffer += '{'
        index += 1
        continue
      }

      nodes.push(tagResult.node)
      index = tagResult.index
      continue
    }

    if (!options.endOn && (char === ':' || char === '|' || char === '}')) {
      if (textBuffer.length === 0) textStart = index
      textBuffer += char
      index += 1
      continue
    }

    if (textBuffer.length === 0) textStart = index
    textBuffer += char
    index += 1
  }

  flushText(index)
  return { segment: { nodes }, index }
}

type TagResult =
  | { closed: true; node: TagNode; index: number }
  | { closed: false; index: number }

function parseTag(input: string, startIndex: number, depth: number): TagResult {
  if (depth > 1000) {
    throw new RenderError('Recursion limit reached')
  }

  let index = startIndex + 1
  const nameStart = index

  while (index < input.length && input[index] !== ':' && input[index] !== '}') {
    index += 1
  }

  const name = input.slice(nameStart, index)

  // Empty tag names ({} or {:...}) are literal text, not tags
  if (name === '') {
    return { index: startIndex, closed: false }
  }

  const args: Segment[] = []

  if (input[index] === ':') {
    index += 1
    while (index <= input.length) {
      const segmentResult = parseSegment(input, index, { endOn: '|', depth })
      args.push(segmentResult.segment)
      index = segmentResult.index

      if (input[index] === '|') {
        index += 1
        continue
      }

      break
    }
  }

  const closed = input[index] === '}'
  if (closed) {
    index += 1
    const span: Span = { start: startIndex, end: index }
    const node: TagNode = { type: 'tag', name, args, span }
    return { node, index, closed: true }
  }

  return { index, closed: false }
}
