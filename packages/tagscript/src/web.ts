import { createWebDefaultRegistry } from './default-registry.js'
import { parse } from './parser.js'
import { renderWithDefaultRegistry } from './runtime/entry.js'
import type { RenderOptions, RenderResult, TagRegistry } from './types.js'

export { RenderError } from './runtime/errors.js'
export { DEFAULT_LIMITS } from './runtime/limits.js'
export { createRegistry } from './runtime/registry.js'
export { renderSegment } from './runtime/renderer.js'
export { serializeSegment } from './runtime/serialize.js'
export type { Sandbox, SandboxResult } from './sandbox/types.js'
export type {
  Ast,
  DiscordContext,
  DiscordUser,
  LazyTagHandler,
  Limits,
  Node,
  RenderContext,
  RenderMode,
  RenderOptions,
  RenderResult,
  Segment,
  Span,
  TagHandler,
  TagNode,
  TagRegistry,
  TagStore,
  TextNode,
} from './types.js'

export const defaultRegistry = createWebDefaultRegistry()

export async function render(
  input: string,
  options: RenderOptions = {},
): Promise<RenderResult> {
  return renderWithDefaultRegistry(input, options, defaultRegistry)
}

/**
 * Build a fresh default registry. Each call returns an independent instance,
 * so callers can extend or wrap it without affecting other renders.
 */
export function createDefaultRegistry(): TagRegistry {
  return createWebDefaultRegistry()
}

export { parse }
