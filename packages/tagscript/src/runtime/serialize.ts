import type { Node, Segment, TagNode } from '../types.js'

export function serializeSegment(segment: Segment): string {
  return segment.nodes.map(serializeNode).join('')
}

export function serializeNode(node: Node): string {
  if (node.type === 'text') {
    return node.value
  }

  return serializeTag(node)
}

export function serializeTag(tag: TagNode): string {
  const args = tag.args.map(serializeSegment)
  const argsText = args.length > 0 ? `:${args.join('|')}` : ''
  return `{${tag.name}${argsText}}`
}
