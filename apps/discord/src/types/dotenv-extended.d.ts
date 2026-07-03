// dotenv-extended@3 ships dotenv-extended.d.ts but its package.json exports
// map lacks a "types" condition, so nodenext resolution never finds it.
// Minimal declaration for the surface we use.
declare module 'dotenv-extended' {
  export interface DotenvExtendedOptions {
    encoding?: string
    silent?: boolean
    path?: string
    defaults?: string
    schema?: string
    errorOnMissing?: boolean
    errorOnExtra?: boolean
    errorOnRegex?: boolean
    includeProcessEnv?: boolean
    assignToProcessEnv?: boolean
    overrideProcessEnv?: boolean
  }

  export function load(
    options?: DotenvExtendedOptions,
  ): Record<string, string>

  const dotenvExtended: { load: typeof load }
  export default dotenvExtended
}
