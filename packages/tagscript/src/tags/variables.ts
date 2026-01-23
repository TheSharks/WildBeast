import type { RenderContext, TagHandler } from '../types.js'

export const setHandler: TagHandler = (ctx: RenderContext, args: string[]) => {
  const [key, value] = args
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
  const key = args[0]
  if (key && ctx.variables && ctx.variables.has(key)) {
    ctx.variables.delete(key)
  }
  return ''
}
