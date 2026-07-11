import { DEFAULT_LIMITS } from '../runtime/limits.js'
import { consumeRegexBudget, isRegexSafe } from '../runtime/regex-safety.js'
import { renderExpansion, renderSegment } from '../runtime/renderer.js'
import { serializeSegment } from '../runtime/serialize.js'
import type {
  LazyTagHandler,
  Limits,
  RenderContext,
  Segment,
} from '../types.js'

/**
 * Banded Levenshtein check: only cells within `max` of the diagonal can stay
 * at or under `max`, so the full matrix is never allocated. Runs in
 * O(max * length) time and O(max) memory regardless of operand size.
 */
export function withinEditDistance(a: string, b: string, max: number): boolean {
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > max) return false
  if (la === 0 || lb === 0) return true

  const infinity = max + 1
  const width = 2 * max + 1

  // row[k] holds the distance for column j = i + k - max at row i.
  let prev = new Array<number>(width).fill(infinity)
  for (let k = max; k < width && k - max <= la; k++) {
    prev[k] = k - max
  }

  for (let i = 1; i <= lb; i++) {
    const curr = new Array<number>(width).fill(infinity)
    let best = infinity

    for (let k = 0; k < width; k++) {
      const j = i + k - max
      if (j < 0 || j > la) continue

      let value: number
      if (j === 0) {
        value = i
      } else {
        const cost = b.charCodeAt(i - 1) === a.charCodeAt(j - 1) ? 0 : 1
        const diagonal = prev[k] + cost
        const above = (k + 1 < width ? prev[k + 1] : infinity) + 1
        const left = (k - 1 >= 0 ? curr[k - 1] : infinity) + 1
        value = Math.min(diagonal, above, left)
      }

      curr[k] = Math.min(value, infinity)
      best = Math.min(best, curr[k])
    }

    if (best > max) return false
    prev = curr
  }

  const finalBand = la - lb + max
  return finalBand >= 0 && finalBand < width && prev[finalBand] <= max
}

async function renderOptionalSegment(
  segment: Segment | undefined,
  ctx: RenderContext,
  limits: Limits,
  depth: number,
): Promise<string> {
  if (!segment) return ''
  return renderSegment(segment, ctx, '', limits, depth)
}

export const ifHandler: LazyTagHandler = async (
  ctx: RenderContext,
  args,
  limits,
  depth = 0,
) => {
  const limitsToUse = limits ?? DEFAULT_LIMITS

  const [conditionArg, operatorArg, valueArg, thenArg, elseArg] = args

  const condition = await renderOptionalSegment(
    conditionArg,
    ctx,
    limitsToUse,
    depth + 1,
  )
  const operator = await renderOptionalSegment(
    operatorArg,
    ctx,
    limitsToUse,
    depth + 1,
  )
  const value = await renderOptionalSegment(
    valueArg,
    ctx,
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
      conditionResult = withinEditDistance(
        condition.toLowerCase(),
        value.toLowerCase(),
        2,
      )
      break
    case '?': {
      // JagTag behavior: Regex match (value is pattern, condition is text)
      if (
        value.length > limitsToUse.regexPatternLength ||
        condition.length > limitsToUse.maxRegexInputLength
      ) {
        conditionResult = false
        break
      }
      // The budget is a hard limit and throws; an unverifiable pattern just
      // evaluates to false, matching the operator's tolerant behavior.
      consumeRegexBudget(ctx, limitsToUse)
      if (!(await isRegexSafe(value, 'g'))) {
        conditionResult = false
        break
      }
      try {
        conditionResult = new RegExp(value, 'g').exec(condition) !== null
      } catch {
        conditionResult = false
      }
      break
    }
    default:
      conditionResult = false
  }

  const branchToRender = conditionResult ? thenArg : elseArg
  return renderOptionalSegment(branchToRender, ctx, limitsToUse, depth + 1)
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
  const source = await renderOptionalSegment(arg, ctx, limitsToUse, depth + 1)
  if (!source) return ''

  // The deliberate literal-to-executable transition: whatever the argument
  // rendered to is parsed and rendered again as TagScript.
  return renderExpansion(source, ctx, limitsToUse, depth + 1)
}
