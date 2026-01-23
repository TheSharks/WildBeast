import type { Limits } from '../types.js'

export type { Limits }

export const DEFAULT_LIMITS: Limits = {
  maxIterations: 100,
  maxOutputLength: 100000,
  maxDepth: 100,
  regexPatternLength: 1000,
  maxRegexInputLength: 10000,
  maxFetchRequests: 3,
}

export function checkLimits(
  output: string,
  limits: Limits,
  iteration: number,
  depth: number,
): void {
  if (output.length > limits.maxOutputLength) {
    throw new Error(
      `Output exceeded maximum length of ${limits.maxOutputLength} characters`,
    )
  }
  if (iteration >= limits.maxIterations) {
    throw new Error(`Exceeded maximum iterations of ${limits.maxIterations}`)
  }
  if (depth > limits.maxDepth) {
    throw new Error(`Exceeded maximum depth of ${limits.maxDepth}`)
  }
}

export function getLimits(options: {
  maxIterations?: number
  maxOutputLength?: number
  maxDepth?: number
  regexPatternLength?: number
  maxRegexInputLength?: number
  maxFetchRequests?: number
}): Limits {
  return {
    maxIterations: options.maxIterations ?? DEFAULT_LIMITS.maxIterations,
    maxOutputLength: options.maxOutputLength ?? DEFAULT_LIMITS.maxOutputLength,
    maxDepth: options.maxDepth ?? DEFAULT_LIMITS.maxDepth,
    regexPatternLength:
      options.regexPatternLength ?? DEFAULT_LIMITS.regexPatternLength,
    maxRegexInputLength:
      options.maxRegexInputLength ?? DEFAULT_LIMITS.maxRegexInputLength,
    maxFetchRequests:
      options.maxFetchRequests ?? DEFAULT_LIMITS.maxFetchRequests,
  }
}
