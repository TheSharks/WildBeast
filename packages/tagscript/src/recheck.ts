import { RenderError } from './runtime/errors.js'
import type { RegexSafety } from './types.js'

export type { RegexSafety } from './types.js'

const DEFAULT_TIMEOUT_MS = 500

type RecheckModule = typeof import('recheck')
let recheckModule: Promise<RecheckModule> | undefined

// Loaded on first use so bundlers can split recheck (a large compiled
// analyzer) out of entrypoint chunks; browsers only pay for it when a
// template actually uses a regex tag.
function loadRecheck(): Promise<RecheckModule> {
  recheckModule ??= import('recheck').catch(() => {
    // Say what is wrong. Left alone, the failure would read as an unsafe
    // pattern, because the renderer fails closed on checker errors.
    throw new RenderError(
      'Regex tags need the recheck package, which is not installed. Add it with: npm install recheck',
    )
  })
  return recheckModule
}

export interface RecheckSafetyOptions {
  /** Analysis budget per pattern in milliseconds. Defaults to 500. */
  timeout?: number
}

/**
 * A `regexSafety` checker backed by recheck's ReDoS analysis. Anything other
 * than a positive "safe" verdict (vulnerable, unknown, timeout) is unsafe.
 * Requires the optional `recheck` peer dependency.
 */
export function createRecheckSafety(
  options: RecheckSafetyOptions = {},
): RegexSafety {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS
  return {
    async isSafe(pattern, flags) {
      const { check } = await loadRecheck()
      const diagnostics = await check(pattern, flags, { timeout })
      return diagnostics.status === 'safe'
    },
  }
}

/** Ready-made checker with the default 500 ms budget. */
export const recheckSafety: RegexSafety = createRecheckSafety()
