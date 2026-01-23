import { renderSegment } from '../runtime/renderer.js'
import type { LazyTagHandler, RenderContext } from '../types.js'

export const fetchHandler: LazyTagHandler = async (
  ctx: RenderContext,
  args,
  limits,
) => {
  const [urlArg, verbArg] = args

  const { output: url } = await renderSegment(urlArg, ctx, '', limits, 0)
  const { output: verb } = verbArg
    ? await renderSegment(verbArg, ctx, '', limits, 0)
    : { output: 'GET' }

  let options: RequestInit = {
    method: verb.toUpperCase(),
    headers: {
      'User-Agent': '@TheSharks/TagScript/1.0 #github.com/TheSharks/WildBeast',
    },
  }

  if (!ctx.options.enableFetch) {
    throw new Error('Fetch tag is disabled in the current context')
  }

  if (ctx.fetchRequests >= limits.maxFetchRequests) {
    throw new Error(
      `Exceeded maximum fetch requests of ${limits.maxFetchRequests}`,
    )
  }

  ctx.fetchRequests++

  const response = await fetch(url, {
    ...options,
    ...ctx.options.fetchOptions,
  })
  if (!response.ok) {
    throw new Error(`Fetch request failed with status ${response.status}`)
  }
  const text = await response.text()
  return text
}
