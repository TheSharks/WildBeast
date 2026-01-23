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
import { checkLimits, type Limits } from './limits.js'
import { serializeSegment, serializeTag } from './serialize.js'

export async function render(
  input: string,
  context: RenderContext,
  limits: Limits,
): Promise<RenderResult> {
  let output = input
  let iteration = 0

  while (iteration < limits.maxIterations) {
    const ast = parse(output)
    const { output: newOutput, depth } = await renderSegment(
      ast,
      context,
      output,
      limits,
      0,
    )

    checkLimits(newOutput, limits, iteration, depth)

    if (newOutput === output) {
      break
    }

    output = newOutput
    iteration++
  }

  return { output }
}

export async function renderSegment(
  segment: Segment,
  context: RenderContext,
  input: string,
  limits: Limits,
  depth: number,
): Promise<{ output: string; depth: number }> {
  let output = ''
  let maxDepth = 0

  for (const node of segment.nodes) {
    const result = await renderNode(node, context, input, limits, depth)
    output += result.output
    maxDepth = Math.max(maxDepth, result.depth)
  }

  return { output, depth: maxDepth }
}

async function renderNode(
  node: Node,
  context: RenderContext,
  input: string,
  limits: Limits,
  depth: number,
): Promise<{ output: string; depth: number }> {
  if (node.type === 'text') {
    return { output: node.value, depth: 0 }
  }

  return renderTag(node, context, input, limits, depth)
}

async function renderTag(
  tag: TagNode,
  context: RenderContext,
  input: string,
  limits: Limits,
  depth: number,
): Promise<{ output: string; depth: number }> {
  if (depth > limits.maxDepth) {
    throw new RenderError(`Exceeded maximum depth of ${limits.maxDepth}`)
  }

  const registry = context.registry
  const isLazy = registry?.isLazy?.(tag.name)

  if (isLazy) {
    const lazyHandler = registry?.getLazy?.(tag.name)
    if (lazyHandler === undefined) {
      return renderUnknownTag(tag, context, input)
    }

    const result = await lazyHandler(context, tag.args, limits)
    return { output: result, depth: 1 }
  }

  const handler = registry?.get(tag.name)
  if (!handler) {
    if (context.variables && context.variables.has(tag.name)) {
      const output = context.variables.get(tag.name) ?? ''
      return { output, depth: 0 }
    }
    return renderUnknownTag(tag, context, input)
  }

  const args = await Promise.all(
    tag.args.map(async (arg) =>
      renderSegment(arg, context, input, limits, depth + 1),
    ),
  )
  const maxArgDepth = args.reduce((max, arg) => Math.max(max, arg.depth), 0)
  const result = await handler(
    context,
    args.map((a) => a.output),
    limits,
  )
  return { output: result, depth: maxArgDepth + 1 }
}

export async function renderAst(
  ast: Ast,
  context: RenderContext,
  limits: Limits,
): Promise<RenderResult> {
  const input = serializeSegment(ast)
  const { output } = await renderSegment(ast, context, input, limits, 0)
  return { output }
}

function renderUnknownTag(
  tag: TagNode,
  context: RenderContext,
  input: string,
): { output: string; depth: number } {
  if (context.mode === 'strict') {
    throw new RenderError('Unknown tag')
  }

  const output = renderTagLiteral(tag, input)
  return { output, depth: 0 }
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
