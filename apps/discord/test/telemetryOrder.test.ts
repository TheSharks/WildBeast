import { readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * An OpenTelemetry instrument created before `initOpenTelemetry` registers the
 * meter provider never records. Static imports evaluate before an entry
 * point's body, so nothing an entry point imports statically may create
 * instruments. Such modules are loaded with `await import()` after telemetry
 * starts instead.
 */
const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

const STATIC_IMPORT =
  /^(?:import|export)\s+(?!type\b)[^;]*?from\s+'(\.[^']+)'|^import\s+'(\.[^']+)'/gms
// The shared meter, or an instrument made at module scope without it.
const TOUCHES_METER =
  /from '[^']*telemetry\/meter\.mjs'|^(?:export )?const \w+ =\s*(?:metrics\s*\.getMeter|createGauge\()/m

/** Every module the entry point loads before its own body runs, with the importer. */
function loadedBeforeBody(entry: string): Map<string, string | undefined> {
  const seen = new Map<string, string | undefined>()
  const queue: Array<[string, string | undefined]> = [[entry, undefined]]
  for (const [file, importer] of queue) {
    if (seen.has(file)) continue
    seen.set(file, importer)
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const specifier = (match[1] ?? match[2]) as string
      queue.push([
        resolve(dirname(file), specifier.replace(/\.mjs$/, '.mts')),
        file,
      ])
    }
  }
  return seen
}

describe('telemetry starts before any instrument exists', () => {
  it.each(['main.mts', 'cluster.mts'])(
    '%s statically imports no module that creates instruments',
    (entry) => {
      const entryPath = join(src, entry)
      const loaded = loadedBeforeBody(entryPath)
      const offenders: string[] = []
      for (const file of loaded.keys()) {
        if (file === entryPath) continue
        if (!TOUCHES_METER.test(readFileSync(file, 'utf8'))) continue
        const chain = [file]
        for (let at = loaded.get(file); at; at = loaded.get(at)) chain.push(at)
        offenders.push(chain.map((step) => relative(src, step)).join(' <- '))
      }
      expect(
        offenders,
        'Load these with await import() after initOpenTelemetry, or their metrics never record',
      ).toEqual([])
    },
  )
})
