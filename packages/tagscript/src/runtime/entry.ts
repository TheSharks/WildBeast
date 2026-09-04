import type {
  RenderContext,
  RenderOptions,
  RenderResult,
  TagRegistry,
} from '../types.js'
import { RenderError } from './errors.js'
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

  // Normalize allowlist once (case/trailing-dot) for exact-match checks.
  const normalizedOptions: RenderOptions = options.fetchAllowedHosts
    ? {
        ...options,
        fetchAllowedHosts: options.fetchAllowedHosts.map((host) =>
          host.toLowerCase().replace(/\.+$/, ''),
        ),
      }
    : options

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
    options: normalizedOptions,
    fetchRequests: 0,
    expansions: 0,
    regexOperations: 0,
  }
  let result: RenderResult
  try {
    result = await renderInternal(input, context, limits)
  } catch (error) {
    // Single user-facing error type for embedders.
    if (error instanceof RenderError) throw error
    if (error instanceof URIError) {
      throw new RenderError(`Invalid URL encoding: ${error.message}`)
    }
    throw error
  }

  if (options.variables && !(options.variables instanceof Map)) {
    for (const [key, value] of context.variables ?? []) {
      options.variables[key] = value
    }
    // Sync deletions back.
    for (const key of Object.keys(options.variables)) {
      if (!context.variables?.has(key)) {
        delete options.variables[key]
      }
    }
  }

  return result
}
