import type { LazyTagHandler, TagHandler, TagRegistry } from '../types.js'

export function createRegistry(
  handlers: Record<string, TagHandler>,
  lazyHandlers?: Record<string, LazyTagHandler>,
): TagRegistry {
  // Maps built from own enumerable entries only, so inherited names like
  // {toString} or {__proto__} never resolve to a handler.
  const handlerMap = new Map(Object.entries(handlers))
  const lazyMap = new Map(Object.entries(lazyHandlers ?? {}))

  return {
    get: (name) => handlerMap.get(name),
    isLazy: (name) => lazyMap.has(name),
    getLazy: (name) => lazyMap.get(name),
  }
}
