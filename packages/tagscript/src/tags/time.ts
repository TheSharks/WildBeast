import type { RenderContext, TagHandler } from '../types.js'

function formatDate(date: Date, format: string): string {
  const tokens: Record<string, string> = {
    yyyy: String(date.getUTCFullYear()),
    MM: String(date.getUTCMonth() + 1).padStart(2, '0'),
    M: String(date.getUTCMonth() + 1),
    dd: String(date.getUTCDate()).padStart(2, '0'),
    d: String(date.getUTCDate()),
    HH: String(date.getUTCHours()).padStart(2, '0'),
    mm: String(date.getUTCMinutes()).padStart(2, '0'),
    ss: String(date.getUTCSeconds()).padStart(2, '0'),
  }

  // Single pass so substituted values can't be re-matched as tokens,
  // and repeated tokens are all replaced
  return format.replace(
    /yyyy|MM|dd|HH|mm|ss|M|d/g,
    (token) => tokens[token] ?? token,
  )
}

export const nowHandler: TagHandler = () => {
  return String(Date.now())
}

export const timeHandler: TagHandler = (
  _ctx: RenderContext,
  args: string[],
) => {
  if (args.length === 0) {
    return String(Date.now())
  }

  const firstArg = args[0]
  const secondArg = args[1]

  if (secondArg) {
    const timestamp = parseInt(firstArg, 10)
    const date = new Date(timestamp)
    if (secondArg === 'iso') {
      return date.toISOString()
    }
    return formatDate(date, secondArg)
  }

  if (firstArg === 'timestamp') {
    return String(Date.now())
  }

  const possibleTimestamp = parseInt(firstArg, 10)
  if (!isNaN(possibleTimestamp) && firstArg === String(possibleTimestamp)) {
    return String(possibleTimestamp)
  }

  const date = new Date()
  if (firstArg === 'iso') {
    return date.toISOString()
  }
  return formatDate(date, firstArg)
}
