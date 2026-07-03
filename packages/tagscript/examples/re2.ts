/**
 * Example: Using node-re2 for regex operations in tagscript
 *
 * RE2 is a fast, safe regular expression engine that guarantees linear time
 * execution and bounded memory consumption. Unlike JavaScript's built-in
 * RegExp, RE2 cannot hang on malicious patterns (ReDoS-safe by design).
 *
 * This example shows how to override the default regex handlers to use RE2.
 *
 * @see https://github.com/uhop/node-re2
 *
 * Install: pnpm add re2
 */

// @ts-expect-error - re2 is not installed by default, users must install it
import RE2 from 're2'
import { createRegistry, defaultRegistry, render } from '../src/index.js'
import { DEFAULT_LIMITS } from '../src/runtime/limits.js'
import { renderSegment } from '../src/runtime/renderer.js'
import type { LazyTagHandler, TagHandler } from '../src/types.js'

/**
 * RE2-based replaceregex handler (drop-in replacement for the default)
 *
 * Supports both syntaxes:
 * - TagScript: {replaceregex:text|pattern|replacement}
 * - JagTag: {replaceregex:pattern|with:replacement|in:text}
 */
const replaceregexHandler: TagHandler = (_ctx, args, limits) => {
  let text: string | undefined
  let pattern: string | undefined
  let replacement: string | undefined

  const withIndex = args.findIndex((a) => a.startsWith('with:'))
  const inIndex = args.findIndex((a) => a.startsWith('in:'))

  if (withIndex >= 0 || inIndex >= 0) {
    // JagTag syntax
    pattern = args[0]
    replacement = withIndex >= 0 ? args[withIndex].slice(5) : undefined
    text = inIndex >= 0 ? args[inIndex].slice(3) : undefined
  } else {
    // TagScript syntax
    ;[text, pattern, replacement] = args
  }

  if (!text || !pattern) return text ?? ''

  // Guard against excessively long patterns
  if (pattern.length > limits.regexPatternLength) {
    throw new Error('Regex pattern too long')
  }

  // Parse pattern string e.g. /search/flags
  const match = pattern.match(/^\/(.+)\/([gimsuy]*)$/)

  try {
    let re2: RE2
    if (match) {
      const [, patternBody, flags] = match
      re2 = new RE2(patternBody, flags)
    } else {
      // Fallback: treat entire string as a global regex pattern
      re2 = new RE2(pattern, 'g')
    }

    // RE2 provides replace method that works like str.replace(regexp, newStr)
    return re2.replace(text, replacement ?? '')
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid regex: ${error.message}`)
    }
    throw new Error('Invalid regex: Unknown error')
  }
}

/**
 * RE2-based if handler (drop-in replacement for the default)
 *
 * Supports all the same operators as the default:
 * - = or == : equality
 * - != or !== : inequality
 * - >, <, >=, <= : numeric comparison
 * - ~ : fuzzy match (Levenshtein distance <= 2)
 * - ? : regex match (RE2-powered, ReDoS-safe)
 */
const ifHandler: LazyTagHandler = async (ctx, args, limits) => {
  const limitsToUse = limits ?? DEFAULT_LIMITS

  const [conditionArg, operatorArg, valueArg, thenArg, elseArg] = args

  const { output: condition } = await renderSegment(
    conditionArg,
    ctx,
    '',
    limitsToUse,
    0,
  )
  const { output: operator } = await renderSegment(
    operatorArg,
    ctx,
    '',
    limitsToUse,
    0,
  )
  const { output: value } = await renderSegment(
    valueArg,
    ctx,
    '',
    limitsToUse,
    0,
  )

  let conditionResult = false

  switch (operator.trim()) {
    case '=':
    case '==':
      conditionResult = condition === value
      break
    case '!=':
    case '!==':
      conditionResult = condition !== value
      break
    case '>':
      conditionResult = parseFloat(condition) > parseFloat(value)
      break
    case '<':
      conditionResult = parseFloat(condition) < parseFloat(value)
      break
    case '>=':
      conditionResult = parseFloat(condition) >= parseFloat(value)
      break
    case '<=':
      conditionResult = parseFloat(condition) <= parseFloat(value)
      break
    case '~':
      // Fuzzy match: Levenshtein distance <= 2, case-insensitive
      conditionResult =
        levenshtein(condition.toLowerCase(), value.toLowerCase()) <= 2
      break
    case '?':
      // Regex match using RE2 (ReDoS-safe by design)
      try {
        if (value.length > limitsToUse.regexPatternLength) {
          conditionResult = false
          break
        }
        // RE2 is safe - no need for ReDoS checks
        const re2 = new RE2(value, 'g')
        conditionResult = re2.test(condition)
      } catch {
        conditionResult = false
      }
      break
    default:
      conditionResult = false
  }

  const branchToRender = conditionResult ? thenArg : elseArg
  if (!branchToRender) {
    return ''
  }
  const { output } = await renderSegment(
    branchToRender,
    ctx,
    '',
    limitsToUse,
    0,
  )

  return output
}

// Levenshtein distance helper (same as in default implementation)
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Create a registry that uses RE2 for regex operations.
 *
 * This extends the default registry, overriding only the regex-related handlers.
 * All other tags (math, strings, variables, etc.) use the default implementations.
 */
export function createRE2Registry() {
  // Get all default eager handlers
  const eagerHandlers: Record<string, TagHandler> = {}
  for (const name of [
    'args',
    'arg',
    'argslen',
    'set',
    'get',
    'delete',
    'upper',
    'lower',
    'length',
    'replace',
    'reverse',
    'url',
    'substring',
    'oneline',
    'hash',
    'math',
    'abs',
    'sin',
    'cos',
    'tan',
    'sqrt',
    'floor',
    'ceil',
    'round',
    'base',
    'pi',
    'e',
    'choose',
    'range',
    'add',
    'subtract',
    'multiply',
    'divide',
    'pow',
    'mod',
    'random',
    'now',
    'time',
    'uuid',
    'userid',
    'usertag',
    'mention',
    'channelid',
    'server',
    'serverid',
    'avatar',
    'js',
    'javascript',
  ]) {
    const handler = defaultRegistry.get(name)
    if (handler) eagerHandlers[name] = handler
  }

  // Override replaceregex with RE2 version
  eagerHandlers.replaceregex = replaceregexHandler

  // Get all default lazy handlers except 'if'
  const lazyHandlers: Record<string, LazyTagHandler> = {}
  for (const name of ['fetch', 'note', 'ignore', 'eval']) {
    const handler = defaultRegistry.getLazy?.(name)
    if (handler) lazyHandlers[name] = handler
  }

  // Override 'if' with RE2 version
  lazyHandlers.if = ifHandler

  return createRegistry(eagerHandlers, lazyHandlers)
}

// Example usage
async function main() {
  const registry = createRE2Registry()

  // Basic replacement - same syntax as default
  const result1 = await render(
    '{replaceregex:Hello World hello|/hello/gi|Hi}',
    {
      registry,
    },
  )
  console.log('Replace result:', result1.output) // "Hi World Hi"

  // Conditional with regex - same syntax as default
  const result2 = await render('{if:hello123|?|\\d+|has numbers|no numbers}', {
    registry,
  })
  console.log('Conditional:', result2.output) // "has numbers"

  // RE2 safely handles patterns that would cause ReDoS with standard RegExp
  // This pattern is catastrophic with standard regex but safe with RE2:
  console.log('\nTesting ReDoS-safe execution...')
  const start = Date.now()
  const result3 = await render(
    '{if:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!|?|^(a+)+$|match|no match}',
    { registry },
  )
  console.log(
    `ReDoS pattern result: "${result3.output}" (${Date.now() - start}ms)`,
  )
  // With standard RegExp this would hang, with RE2 it's instant

  // JagTag syntax also works
  const result4 = await render(
    '{replaceregex:\\d+|with:#|in:I have 5 cats and 23 dogs}',
    { registry },
  )
  console.log('JagTag syntax:', result4.output) // "I have # cats and ## dogs"
}

main().catch(console.error)
