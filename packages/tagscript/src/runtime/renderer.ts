import { parse } from '../parser.js'
import type {
  Ast,
  Node,
  RenderContext,
  RenderResult,
  Segment,
  TagNode,
} from '../types.js'
import { RenderError } from './errors.js'
import type { Limits } from './limits.js'
import { serializeTag } from './serialize.js'

// Rendering is a single top-down pass over the parse tree. Handler output is
// literal: it is appended to the surrounding output verbatim and never parsed
// as TagScript again. The only ways rendered text becomes executable are the
// deliberate transitions routed through renderExpansion ({eval} and stored
// tags), each of which counts against the maxIterations expansion budget.

export async function render(
  input: string,
  context: RenderContext,
  limits: Limits,
): Promise<RenderResult> {
  const ast = parse(input)
  const output = await renderSegment(ast, context, input, limits, 0)

  const result: RenderResult = { output }
  if (context.attachment) {
    result.attachment = context.attachment
  }
  return result
}

/**
 * Parse a string of TagScript source and render it. This is the deliberate
 * literal-to-executable transition: everything else in the renderer treats
 * strings as inert text. Bounded by the maxIterations expansion budget in
 * addition to the regular depth budget.
 */
export async function renderExpansion(
  source: string,
  context: RenderContext,
  limits: Limits,
  depth: number,
): Promise<string> {
  context.expansions++
  if (context.expansions > limits.maxIterations) {
    throw new RenderError(
      `Exceeded maximum expansions of ${limits.maxIterations}`,
    )
  }
  if (depth > limits.maxDepth) {
    throw new RenderError(`Exceeded maximum depth of ${limits.maxDepth}`)
  }

  const ast = parse(source)
  return renderSegment(ast, context, source, limits, depth)
}

export async function renderSegment(
  segment: Segment,
  context: RenderContext,
  input: string,
  limits: Limits,
  depth: number,
): Promise<string> {
  let output = ''

  for (const node of segment.nodes) {
    output += await renderNode(node, context, input, limits, depth)
    // Checked while accumulating, not just at the end, so intermediate
    // strings can't grow far beyond the output limit before being caught.
    if (output.length > limits.maxOutputLength) {
      throw new RenderError(
        `Output exceeded maximum length of ${limits.maxOutputLength} characters`,
      )
    }
  }

  return output
}

async function renderNode(
  node: Node,
  context: RenderContext,
  input: string,
  limits: Limits,
  depth: number,
): Promise<string> {
  if (node.type === 'text') {
    return node.value
  }

  return renderTag(node, context, input, limits, depth)
}

async function renderTag(
  tag: TagNode,
  context: RenderContext,
  input: string,
  limits: Limits,
  depth: number,
): Promise<string> {
  if (depth > limits.maxDepth) {
    throw new RenderError(`Exceeded maximum depth of ${limits.maxDepth}`)
  }

  const registry = context.registry

  if (registry?.isLazy?.(tag.name)) {
    const lazyHandler = registry.getLazy?.(tag.name)
    if (lazyHandler === undefined) {
      return renderUnknownTag(tag, context, input)
    }

    const result = await lazyHandler(context, tag.args, limits, depth)
    return checkHandlerOutput(result, limits)
  }

  const handler = registry?.get(tag.name)
  if (!handler) {
    if (context.variables?.has(tag.name)) {
      return context.variables.get(tag.name) ?? ''
    }

    const stored = context.tagStore?.getTagContents(tag.name)
    if (stored !== undefined) {
      return renderExpansion(stored, context, limits, depth + 1)
    }

    return renderUnknownTag(tag, context, input)
  }

  // Arguments render sequentially so tags with side effects ({set}, {fetch})
  // observe a deterministic left-to-right order.
  const args: string[] = []
  for (const arg of tag.args) {
    args.push(await renderSegment(arg, context, input, limits, depth + 1))
  }

  const result = await handler(context, args, limits)
  return checkHandlerOutput(result, limits)
}

function checkHandlerOutput(output: string, limits: Limits): string {
  if (output.length > limits.maxOutputLength) {
    throw new RenderError(
      `Output exceeded maximum length of ${limits.maxOutputLength} characters`,
    )
  }
  return output
}

export async function renderAst(
  ast: Ast,
  context: RenderContext,
  limits: Limits,
): Promise<RenderResult> {
  const output = await renderSegment(ast, context, '', limits, 0)

  const result: RenderResult = { output }
  if (context.attachment) {
    result.attachment = context.attachment
  }
  return result
}

function renderUnknownTag(
  tag: TagNode,
  context: RenderContext,
  input: string,
): string {
  if (context.mode === 'strict') {
    throw new RenderError(`Unknown tag: ${tag.name}`)
  }

  return renderTagLiteral(tag, input)
}

function renderTagLiteral(tag: TagNode, input: string): string {
  if (input) {
    const literal = input.slice(tag.span.start, tag.span.end)
    const prefix = `{${tag.name}`
    if (literal.startsWith(prefix) && literal.endsWith('}')) {
      const nextChar = literal[prefix.length]
      if (nextChar === '}' || nextChar === ':') {
        return literal
      }
    }
  }

  return serializeTag(tag)
}
