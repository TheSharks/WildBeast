import type { Limits } from '../types.js'

export type { Limits }

export const DEFAULT_LIMITS: Limits = {
  maxIterations: 100,
  maxOutputLength: 100000,
  maxDepth: 100,
  regexPatternLength: 1000,
  maxRegexInputLength: 10000,
  maxFetchRequests: 3,
  maxRegexOperations: 10,
}

function resolveLimit(name: keyof Limits, value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_LIMITS[name]
  }
  // NaN disables comparisons; reject as embedder error.
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new RangeError(`Invalid limit for ${name}: ${value}`)
  }
  return value
}

export function getLimits(options: Partial<Limits>): Limits {
  return {
    maxIterations: resolveLimit('maxIterations', options.maxIterations),
    maxOutputLength: resolveLimit('maxOutputLength', options.maxOutputLength),
    maxDepth: resolveLimit('maxDepth', options.maxDepth),
    regexPatternLength: resolveLimit(
      'regexPatternLength',
      options.regexPatternLength,
    ),
    maxRegexInputLength: resolveLimit(
      'maxRegexInputLength',
      options.maxRegexInputLength,
    ),
    maxFetchRequests: resolveLimit(
      'maxFetchRequests',
      options.maxFetchRequests,
    ),
    maxRegexOperations: resolveLimit(
      'maxRegexOperations',
      options.maxRegexOperations,
    ),
  }
}
