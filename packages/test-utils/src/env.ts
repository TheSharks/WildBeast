/**
 * Remove all env vars matching the given prefixes and return a restore
 * function. Use in beforeEach/afterEach to isolate env-driven config.
 */
export function snapshotEnv(prefixes: readonly string[]): () => void {
  const saved = new Map<string, string>()

  for (const key of Object.keys(process.env)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      const value = process.env[key]
      if (value !== undefined) {
        saved.set(key, value)
      }
      delete process.env[key]
    }
  }

  return () => {
    for (const key of Object.keys(process.env)) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        delete process.env[key]
      }
    }
    for (const [key, value] of saved) {
      process.env[key] = value
    }
  }
}
