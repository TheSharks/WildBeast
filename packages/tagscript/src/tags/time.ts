import type { RenderContext, TagHandler } from '../types.js'

function formatDate(date: Date, format: string): string {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()
  const seconds = date.getUTCSeconds()

  return format
    .replace('yyyy', String(year))
    .replace('MM', String(month).padStart(2, '0'))
    .replace('dd', String(day).padStart(2, '0'))
    .replace('d', String(day))
    .replace('M', String(month))
    .replace('HH', String(hours).padStart(2, '0'))
    .replace('mm', String(minutes).padStart(2, '0'))
    .replace('ss', String(seconds).padStart(2, '0'))
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
