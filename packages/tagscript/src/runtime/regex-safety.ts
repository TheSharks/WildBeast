import type { RenderContext } from '../types.js'
import { RenderError } from './errors.js'
import type { Limits } from './limits.js'

const RECHECK_TIMEOUT_MS = 500

type RecheckModule = typeof import('recheck')
let recheckModule: Promise<RecheckModule> | undefined

// Loaded on demand so bundlers can split recheck (a large compiled analyzer)
// out of entrypoint chunks; browsers only pay for it when a template actually
// uses a regex tag.
function loadRecheck(): Promise<RecheckModule> {
  recheckModule ??= import('recheck')
  return recheckModule
}

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
 * True only when recheck positively verifies the pattern as safe. Anything
 * else — vulnerable, unknown, analysis timeout, analyzer failure — fails
 * closed.
 */
export async function isRegexSafe(
  pattern: string,
  flags: string,
): Promise<boolean> {
  try {
    const { check } = await loadRecheck()
    const diagnostics = await check(pattern, flags, {
      timeout: RECHECK_TIMEOUT_MS,
    })
    return diagnostics.status === 'safe'
  } catch {
    return false
  }
}
