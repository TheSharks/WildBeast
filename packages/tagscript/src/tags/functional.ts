import { checkSync } from 'recheck'
import { DEFAULT_LIMITS } from '../runtime/limits.js'
import { renderSegment } from '../runtime/renderer.js'
import { serializeSegment } from '../runtime/serialize.js'
import type { LazyTagHandler, RenderContext } from '../types.js'

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

export const ifHandler: LazyTagHandler = async (
  ctx: RenderContext,
  args,
  limits,
  depth = 0,
) => {
  const limitsToUse = limits ?? DEFAULT_LIMITS

  const [conditionArg, operatorArg, valueArg, thenArg, elseArg] = args

  const { output: condition } = await renderSegment(
    conditionArg,
    ctx,
    '',
    limitsToUse,
    depth + 1,
  )
  const { output: operator } = await renderSegment(
    operatorArg,
    ctx,
    '',
    limitsToUse,
    depth + 1,
  )
  const { output: value } = await renderSegment(
    valueArg,
    ctx,
    '',
    limitsToUse,
    depth + 1,
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
      // JagTag behavior: Levenshtein distance <= 2, case-insensitive
      conditionResult =
        levenshtein(condition.toLowerCase(), value.toLowerCase()) <= 2
      break
    case '?':
      // JagTag behavior: Regex match (value is pattern, condition is text)
      try {
        // Guard against excessively long patterns
        if (value.length > limitsToUse.regexPatternLength) {
          conditionResult = false
          break
        }
        // Guard against excessively long input strings
        if (condition.length > limitsToUse.maxRegexInputLength) {
          conditionResult = false
          break
        }
        // Check for ReDoS vulnerability before executing
        const diagnostic = checkSync(value, 'g')
        if (diagnostic.status === 'vulnerable') {
          conditionResult = false
          break
        }
        conditionResult = new RegExp(value, 'g').exec(condition) !== null
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
    depth + 1,
  )

  return output
}

export const noteHandler: LazyTagHandler = async () => {
  return ''
}

export const ignoreHandler: LazyTagHandler = async (
  _ctx: RenderContext,
  args,
) => {
  return args.map(serializeSegment).join('')
}

export const evalHandler: LazyTagHandler = async (
  ctx: RenderContext,
  args,
  limits,
  depth = 0,
) => {
  const limitsToUse = limits ?? DEFAULT_LIMITS

  const [arg] = args
  const { output } = await renderSegment(arg, ctx, '', limitsToUse, depth + 1)

  return output
}
