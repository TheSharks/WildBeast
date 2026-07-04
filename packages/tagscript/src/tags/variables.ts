import type { RenderContext, TagHandler } from '../types.js'

export const setHandler: TagHandler = (ctx: RenderContext, args: string[]) => {
  const [rawKey, value] = args
  // Trim to stay symmetric with get and delete
  const key = rawKey?.trim()
  // Map handles keys safely, no need to block specific keys like __proto__
  if (key && ctx.variables) {
    ctx.variables.set(key, value ?? '')
  }
  return ''
}

export const getHandler: TagHandler = (ctx: RenderContext, args: string[]) => {
  const key = args[0]?.trim()
  if (!key) return 'undefined'
  return ctx.variables?.get(key) ?? 'undefined'
}

export const deleteHandler: TagHandler = (
  ctx: RenderContext,
  args: string[],
) => {
  const key = args[0]?.trim()
  if (key && ctx.variables && ctx.variables.has(key)) {
    ctx.variables.delete(key)
  }
  return ''
}
