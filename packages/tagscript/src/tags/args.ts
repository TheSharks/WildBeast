import type { RenderContext, TagHandler } from '../types.js'

export const argsHandler: TagHandler = (ctx: RenderContext) => {
  if (!ctx.args || ctx.args.length === 0) return 'undefined'
  return ctx.args.join(' ')
}

export const argHandler: TagHandler = (ctx: RenderContext, args: string[]) => {
  const indexArg = args[0]
  if (!indexArg) return 'undefined'
  const index = parseInt(indexArg, 10)
  if (isNaN(index) || !ctx.args || index >= ctx.args.length) {
    return 'undefined'
  }
  return ctx.args[index] ?? 'undefined'
}

export const argslenHandler: TagHandler = (ctx: RenderContext) => {
  return String(ctx.args?.length ?? 0)
}
