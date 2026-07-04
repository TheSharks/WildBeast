import type { RenderContext, TagHandler } from '../types.js'

export const uuidHandler: TagHandler = () => {
  return crypto.randomUUID()
}
