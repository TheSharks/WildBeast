import { createWebDefaultRegistry } from './default-registry.js'
import { parse } from './parser.js'
import { renderWithDefaultRegistry } from './runtime/entry.js'
import type { RenderOptions, RenderResult } from './types.js'

export { RenderError } from './runtime/errors.js'
export { createRegistry } from './runtime/registry.js'
export type { Ast, RenderOptions, RenderResult } from './types.js'

export const defaultRegistry = createWebDefaultRegistry()

export async function render(
  input: string,
  options: RenderOptions = {},
): Promise<RenderResult> {
  return renderWithDefaultRegistry(input, options, defaultRegistry)
}

export function createDefaultRegistry() {
  return defaultRegistry
}

export { parse }
