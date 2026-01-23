import type { LazyTagHandler, TagHandler, TagRegistry } from '../types.js'

export function createRegistry(
  handlers: Record<string, TagHandler>,
  lazyHandlers?: Record<string, LazyTagHandler>,
): TagRegistry {
  return {
    get: (name) => handlers[name],
    isLazy: (name) => lazyHandlers != null && name in lazyHandlers,
    getLazy: (name) => lazyHandlers?.[name],
  }
}
