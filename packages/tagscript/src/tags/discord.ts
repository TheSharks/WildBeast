import type { RenderContext, TagHandler } from '../types.js'

export const useridHandler: TagHandler = (ctx: RenderContext) => {
  return ctx.discord?.user?.id ?? ''
}

export const usertagHandler: TagHandler = (ctx: RenderContext) => {
  const tag = ctx.discord?.user?.tag ?? ''
  return tag
}

export const mentionHandler: TagHandler = (ctx: RenderContext) => {
  return ctx.discord?.user?.mention ?? ''
}

export const channelidHandler: TagHandler = (ctx: RenderContext) => {
  return ctx.discord?.channelId ?? ''
}

export const serverHandler: TagHandler = (ctx: RenderContext) => {
  return ctx.discord?.server ?? ''
}

export const serveridHandler: TagHandler = (ctx: RenderContext) => {
  return ctx.discord?.serverId ?? ''
}

export const avatarHandler: TagHandler = (ctx: RenderContext) => {
  // Prefer a complete URL from the embedder: constructing one from the user
  // ID alone can't include the avatar hash Discord's CDN requires.
  const avatarUrl = ctx.discord?.user?.avatarUrl
  if (avatarUrl) return avatarUrl

  const userId = ctx.discord?.user?.id
  if (!userId) return ''

  const baseUrl =
    ctx.discord?.user?.avatarBase ??
    `https://cdn.discordapp.com/avatars/${userId}`

  const format = ctx.discord?.user?.avatarFormat ?? 'png'
  const supportedFormats = ['png', 'gif', 'jpeg', 'jpg', 'webp']

  const normalizedFormat = supportedFormats.includes(format) ? format : 'png'

  const extension = normalizedFormat === 'jpeg' ? 'jpg' : normalizedFormat

  return `${baseUrl}/${userId}.${extension}`
}
