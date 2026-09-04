import { RenderError } from '../runtime/errors.js'
import { consumeRegexBudget, isRegexSafe } from '../runtime/regex-safety.js'
import type { Limits, TagHandler } from '../types.js'

export const upperHandler: TagHandler = (_ctx, args) =>
  (args[0] ?? '').toUpperCase()
export const lowerHandler: TagHandler = (_ctx, args) =>
  (args[0] ?? '').toLowerCase()
export const lengthHandler: TagHandler = (_ctx, args) =>
  String((args[0] ?? '').length)

export const replaceHandler: TagHandler = (_ctx, args) => {
  let text: string | undefined
  let search: string | undefined
  let replacement: string | undefined

  // JagTag syntax needs both markers: {replace:search|with:replacement|in:text}.
  // Requiring both keeps native-syntax arguments that merely start with
  // "with:" or "in:" from being misread as JagTag form.
  const withIndex = args.findIndex((a) => a.startsWith('with:'))
  const inIndex = args.findIndex((a) => a.startsWith('in:'))

  if (withIndex >= 0 && inIndex >= 0) {
    // JagTag syntax
    search = args[0]
    replacement = args[withIndex].slice(5)
    text = args[inIndex].slice(3)
  } else {
    // TagScript syntax (backwards compatible)
    ;[text, search, replacement] = args
  }

  // An empty search would make replaceAll insert the replacement between
  // every character; treat it as a no-op instead.
  if (!search) return text ?? ''
  return (text ?? '').replaceAll(search, replacement ?? '')
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

export const reverseHandler: TagHandler = (_ctx, args) => {
  const text = args[0] ?? ''
  return Array.from(segmenter.segment(text))
    .map((segment) => segment.segment)
    .reverse()
    .join('')
}

export const urlHandler: TagHandler = (_ctx, args) => {
  try {
    return encodeURIComponent(args[0] ?? '')
  } catch (error) {
    throw new RenderError(
      `Invalid URL encoding: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export const substringHandler: TagHandler = (_ctx, args) => {
  const [text, startStr, endStr] = args
  const textValue = text ?? ''
  const start = parseInt(startStr ?? '0', 10)
  const end = endStr ? parseInt(endStr, 10) : undefined
  // slice semantics: no silent argument swapping when start > end,
  // and negative indices count from the end
  return end !== undefined
    ? textValue.slice(start, end)
    : textValue.slice(start)
}

// Replaces real newlines and the literal \n sequence (JagTag compatibility)
export const onelineHandler: TagHandler = (_ctx, args) =>
  (args[0] ?? '').replace(/\r\n|[\r\n]|\\n/g, ' ')

export const hashHandler: TagHandler = (_ctx, args) => {
  const text = args[0] ?? ''
  // Java-style hashCode (matches JagTag behavior)
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return String(hash)
}

export const replaceregexHandler: TagHandler = async (
  ctx,
  args,
  limits: Limits,
) => {
  // Support both TagScript syntax {replaceregex:text|pattern|replacement}
  // and JagTag syntax {replaceregex:pattern|with:replacement|in:text}
  let text: string | undefined
  let pattern: string | undefined
  let replacement: string | undefined

  // Both markers required, mirroring replaceHandler's disambiguation rule.
  const withIndex = args.findIndex((a) => a.startsWith('with:'))
  const inIndex = args.findIndex((a) => a.startsWith('in:'))

  if (withIndex >= 0 && inIndex >= 0) {
    // JagTag syntax
    pattern = args[0]
    replacement = args[withIndex].slice(5)
    text = args[inIndex].slice(3)
  } else {
    // TagScript syntax
    ;[text, pattern, replacement] = args
  }

  if (!text || !pattern) return text ?? ''

  // Guard against excessively long patterns
  if (pattern.length > limits.regexPatternLength) {
    throw new RenderError('Regex pattern too long')
  }

  // Guard against excessively long input strings
  if (text.length > limits.maxRegexInputLength) {
    throw new RenderError('Input text too long for regex operation')
  }

  // Parse pattern string e.g. /search/flags
  const match = pattern.match(/^\/(.+)\/([gimsuy]*)$/)

  let patternBody: string
  let flags: string

  if (match) {
    ;[, patternBody, flags] = match
  } else {
    // Fallback: treat entire string as a global regex pattern
    patternBody = pattern
    flags = 'g'
  }

  let regex: RegExp
  try {
    regex = new RegExp(patternBody, flags)
  } catch (error) {
    if (error instanceof Error) {
      throw new RenderError(`Invalid regex: ${error.message}`)
    }
    throw new RenderError('Invalid regex: Unknown error')
  }

  consumeRegexBudget(ctx, limits)
  // Fail closed: only patterns recheck positively verifies as safe run.
  if (!(await isRegexSafe(patternBody, flags))) {
    throw new RenderError('Potentially unsafe regex pattern')
  }

  return text.replace(regex, replacement ?? '')
}
