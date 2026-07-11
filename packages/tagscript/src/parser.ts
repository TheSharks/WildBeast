import { RenderError } from './runtime/errors.js'
import type { Ast, Segment, Span, TagNode, TextNode } from './types.js'

const ESCAPE_MAP: Record<string, string> = {
  '{': '{',
  '}': '}',
  '|': '|',
  '\\': '\\',
}

// Parsing does a bounded amount of work per input character. Memoization
// already collapses repeated tag parses, but pathological inputs (deeply
// nested unclosed tags) can still rescan text between tag positions once per
// nesting level. The budget turns that worst case into an error instead of a
// stall. Real templates use a small fraction of this allowance.
const WORK_PER_CHAR = 32
const WORK_BASE = 4096

type ParseState = {
  /** parseTag results keyed by tag start index; results depend only on position. */
  memo: Map<number, TagResult>
  /** Index of the last '}' in the input; tags starting at or after it can't close. */
  lastClose: number
  work: number
  budget: number
}

export function parse(input: string): Ast {
  const state: ParseState = {
    memo: new Map(),
    lastClose: input.lastIndexOf('}'),
    work: 0,
    budget: input.length * WORK_PER_CHAR + WORK_BASE,
  }
  return parseSegment(input, 0, { endOn: null, depth: 0 }, state).segment
}

type SegmentResult = { segment: Segment; index: number }
type ParseOptions = { endOn: '}' | ':' | '|' | null; depth: number }

function spendWork(state: ParseState, amount: number): void {
  state.work += amount
  if (state.work > state.budget) {
    throw new RenderError('Template too complex to parse')
  }
}

function parseSegment(
  input: string,
  startIndex: number,
  options: ParseOptions,
  state: ParseState,
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
    spendWork(state, 1)
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
      const tagResult = parseTag(input, index, options.depth + 1, state)
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

function parseTag(
  input: string,
  startIndex: number,
  depth: number,
  state: ParseState,
): TagResult {
  if (depth > 1000) {
    throw new RenderError('Recursion limit reached')
  }

  const memoized = state.memo.get(startIndex)
  if (memoized) {
    return memoized
  }

  // A tag needs a name and a closing brace, so the shortest closable form is
  // {x}. When no '}' exists far enough ahead, fail without scanning.
  if (state.lastClose < startIndex + 2) {
    const result: TagResult = { index: startIndex, closed: false }
    state.memo.set(startIndex, result)
    return result
  }

  let index = startIndex + 1
  const nameStart = index

  while (index < input.length && input[index] !== ':' && input[index] !== '}') {
    spendWork(state, 1)
    index += 1
  }

  const name = input.slice(nameStart, index)

  // Empty tag names ({} or {:...}) are literal text, not tags
  if (name === '') {
    const result: TagResult = { index: startIndex, closed: false }
    state.memo.set(startIndex, result)
    return result
  }

  const args: Segment[] = []

  if (input[index] === ':') {
    index += 1
    while (index <= input.length) {
      const segmentResult = parseSegment(
        input,
        index,
        { endOn: '|', depth },
        state,
      )
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
    const result: TagResult = { node, index, closed: true }
    state.memo.set(startIndex, result)
    return result
  }

  const result: TagResult = { index, closed: false }
  state.memo.set(startIndex, result)
  return result
}
