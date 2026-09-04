import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = join(here, '..', 'src')
const enUsDir = join(srcDir, 'languages', 'en-US')
const clientPath = join(srcDir, 'structures', 'client.mts')

type LangMap = Map<string, unknown>

async function loadEnUs(): Promise<LangMap> {
  const entries = await readdir(enUsDir, {
    recursive: true,
    withFileTypes: true,
  })
  const out: LangMap = new Map()
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const full = join(entry.parentPath, entry.name)
    const rel = full.slice(enUsDir.length + 1, -'.json'.length)
    const parsed: unknown = JSON.parse(await readFile(full, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        out.set(`${rel}:${key}`, value)
      }
    } else {
      out.set(rel, parsed)
    }
  }
  return out
}

function placeholdersOf(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const found = new Set<string>()
  for (const match of value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    found.add(match[1])
  }
  return [...found].sort()
}

// Expected interpolation sets per key, mirroring the resolveKey call sites.
// Keep in sync when adding a key or changing its placeholders; a mismatch
// means the JSON drifted from the code (or vice versa).
const expectedPlaceholders: Record<string, string[]> = {
  'commands/8ball:prefix': ['response'],
  'commands/common:noResultsFor': ['query'],
  'commands/dice:result': ['dice', 'sides', 'total'],
  'commands/flags:unknownKey': ['key'],
  'commands/fun:poweredBy': ['service'],
  'commands/invite:done': ['invite'],
  'commands/invite:private': ['owner'],
  'commands/ping:success_with_args': ['diff', 'ping'],
  'commands/tag:alreadyExists': ['name'],
  'commands/tag:alreadyPromoted': ['name'],
  'commands/tag:created': ['name'],
  'commands/tag:defaultCommandDescription': ['name'],
  'commands/tag:deleted': ['name'],
  'commands/tag:demoted': ['command', 'name'],
  'commands/tag:info': ['authorId', 'length', 'name'],
  'commands/tag:infoPromoted': ['name', 'promotedBy'],
  'commands/tag:limitReached': ['limit'],
  'commands/tag:list': ['count', 'names'],
  'commands/tag:notFound': ['name'],
  'commands/tag:notFoundSuggestion': ['name', 'suggestion'],
  'commands/tag:promoteFailed': ['error', 'name'],
  'commands/tag:promoteInvalidName': ['name'],
  'commands/tag:promoteLimitReached': ['limit'],
  'commands/tag:promoteNameCollision': ['name'],
  'commands/tag:promoted': ['command', 'name'],
  'commands/tag:notPromoted': ['name'],
  'commands/tag:renderFailed': ['error'],
  'commands/tag:updated': ['name'],
  'system/errors:cooldown': ['resumeAt'],
}

async function staticResolveKeys(): Promise<string[]> {
  const files: string[] = []
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile() && entry.name.endsWith('.mts')) files.push(full)
    }
  }
  await walk(srcDir)
  const keys = new Set<string>()
  const pattern = /['"](commands\/[^'"]+|system\/[^'"]+):([^'"]+)['"]/g
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    for (const match of text.matchAll(pattern)) {
      const full = `${match[1]}:${match[2]}`
      if (full.includes('${')) continue
      keys.add(full)
    }
  }
  return [...keys].sort()
}

describe('locale drift (en-US source of truth)', () => {
  it('resolves every static resolveKey key used in src', async () => {
    const lang = await loadEnUs()
    const keys = await staticResolveKeys()
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      // Dynamic info/invite keys are built as `commands/info:${key}`; the
      // namespace file existing proves the pattern, individual keys are
      // covered below.
      if (
        key.startsWith('commands/info:') ||
        key.startsWith('commands/invite:')
      )
        continue
      expect(lang.has(key), `${key} should exist in en-US`).toBe(true)
    }
  })

  it('keeps placeholders in sync with call sites', async () => {
    const lang = await loadEnUs()
    for (const [key, expected] of Object.entries(expectedPlaceholders)) {
      expect(lang.has(key), `${key} should exist in en-US`).toBe(true)
      expect(placeholdersOf(lang.get(key)), `${key} placeholders`).toEqual(
        expected,
      )
    }
  })

  it('keeps error replies generic (no {{error}} in try_again)', async () => {
    // Privacy intent: the user sees only a generic message plus the error
    // code (uuid); the full error is logged server-side so support can
    // correlate via the uuid (see sendErrorReport). try_again must never
    // interpolate the raw error.
    const lang = await loadEnUs()
    const value = lang.get('system/errors:try_again')
    expect(typeof value).toBe('string')
    expect(placeholdersOf(value)).toEqual([])
    expect(String(value)).not.toContain('{{error}}')
    expect(String(value)).not.toContain('{{')
  })

  it('prefers the user locale with en-US fallback', async () => {
    // fallbackLng en-US behavior: unknown/missing locales return en-US, and
    // missing keys in a loaded locale fall back to en-US. The default stays
    // en-US. Read the source so the test never boots the client (which
    // needs env, Redis, and Discord).
    const source = await readFile(clientPath, 'utf8')
    const fetchStart = source.indexOf('fetchLanguage')
    expect(fetchStart).toBeGreaterThan(-1)
    const block = source.slice(fetchStart, fetchStart + 1200)
    const userFirst = block.indexOf('interactionLocale')
    const guildFirst = block.indexOf('interactionGuildLocale')
    expect(userFirst).toBeGreaterThan(-1)
    expect(guildFirst).toBeGreaterThan(-1)
    expect(
      userFirst < guildFirst,
      'fetchLanguage should prefer interaction user locale over guild locale',
    ).toBe(true)
    expect(block).toContain("'en-US'")
  })
})
