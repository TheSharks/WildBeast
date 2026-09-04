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

  // Require both markers so native args starting with with:/in: aren't misread.
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

  // Empty search is a no-op (avoids replaceAll inter-char insertion).
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
  // Slice semantics: no arg swapping, negatives count from end.
  return end !== undefined
    ? textValue.slice(start, end)
    : textValue.slice(start)
}

// Handles real newlines and literal \n (JagTag compat).
export const onelineHandler: TagHandler = (_ctx, args) =>
  (args[0] ?? '').replace(/\r\n|[\r\n]|\\n/g, ' ')

export const hashHandler: TagHandler = (_ctx, args) => {
  const text = args[0] ?? ''
  // Java-style hashCode for JagTag parity.
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
  // Supports TagScript and JagTag (with:/in:) forms.
  let text: string | undefined
  let pattern: string | undefined
  let replacement: string | undefined

  // Both markers required (mirrors replaceHandler).
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

  if (pattern.length > limits.regexPatternLength) {
    throw new RenderError('Regex pattern too long')
  }

  if (text.length > limits.maxRegexInputLength) {
    throw new RenderError('Input text too long for regex operation')
  }

  // Parses /body/flags form.
  const match = pattern.match(/^\/(.+)\/([gimsuy]*)$/)

  let patternBody: string
  let flags: string

  if (match) {
    ;[, patternBody, flags] = match
  } else {
    // Bare string means global pattern.
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

  // Fail closed: only recheck-verified patterns run.
  consumeRegexBudget(ctx, limits)
  if (!(await isRegexSafe(patternBody, flags))) {
    throw new RenderError('Potentially unsafe regex pattern')
  }

  return text.replace(regex, replacement ?? '')
}
