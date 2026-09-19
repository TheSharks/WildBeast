import type { RenderContext } from '../types.js'
import { RenderError } from './errors.js'
import type { Limits } from './limits.js'

/**
 * Count one regex evaluation against the per-render budget. ReDoS analysis
 * itself costs real time, so the number of analyses a template can trigger
 * must be bounded too.
 */
export function consumeRegexBudget(ctx: RenderContext, limits: Limits): void {
  ctx.regexOperations++
  if (ctx.regexOperations > limits.maxRegexOperations) {
    throw new RenderError(
      `Exceeded maximum regex operations of ${limits.maxRegexOperations}`,
    )
  }
}

/**
 * True only when the configured checker positively verifies the pattern as
 * safe. A checker that throws fails closed. No checker at all is a setup
 * problem, not a verdict on the pattern, so it gets its own error; a checker
 * can report a setup problem of its own the same way, by throwing a
 * RenderError.
 */
export async function isRegexSafe(
  ctx: RenderContext,
  pattern: string,
  flags: string,
): Promise<boolean> {
  const checker = ctx.regexSafety
  if (!checker) {
    throw new RenderError(
      'Regex tags are not enabled. Pass a regexSafety option, for example recheckSafety from @thesharks/tagscript/recheck.',
    )
  }
  try {
    return await checker.isSafe(pattern, flags)
  } catch (error) {
    if (error instanceof RenderError) throw error
    return false
  }
}
