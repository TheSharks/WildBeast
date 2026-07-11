import type {
  RenderContext,
  RenderOptions,
  RenderResult,
  TagRegistry,
} from '../types.js'
import { getLimits } from './limits.js'
import { render as renderInternal } from './renderer.js'

export async function renderWithDefaultRegistry(
  input: string,
  options: RenderOptions,
  defaultRegistry: TagRegistry,
): Promise<RenderResult> {
  const mode = options.mode ?? 'ignore'
  const limits = getLimits(options)

  const enableJs = options.enableJs ?? false
  const sandbox = options.sandbox

  const context: RenderContext = {
    mode,
    registry: options.registry ?? defaultRegistry,
    variables:
      options.variables instanceof Map
        ? options.variables
        : new Map(Object.entries(options.variables ?? {})),
    args: options.args,
    discord: options.discord,
    tagStore: options.tagStore,
    sandbox: enableJs ? sandbox : undefined,
    options,
    fetchRequests: 0,
    expansions: 0,
    regexOperations: 0,
  }
  const result = await renderInternal(input, context, limits)

  if (options.variables && !(options.variables instanceof Map)) {
    for (const [key, value] of context.variables ?? []) {
      options.variables[key] = value
    }
    // Handle deletions (keys present in options.variables but not in context.variables).
    for (const key of Object.keys(options.variables)) {
      if (!context.variables?.has(key)) {
        delete options.variables[key]
      }
    }
  }

  return result
}
