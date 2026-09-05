#!/usr/bin/env node
/**
 * Freeze check for the metrics/telemetry label contract.
 *
 * Single source of truth: METRIC_CONTRACT (+ SENTRY_METRIC_CONTRACT) in
 * packages/analytics/src/utils/metrics.ts.
 *
 * Fails with a diff when:
 *  - code creates an OTel/Sentry metric missing from the contract, or a
 *    contract entry has no emitter in code (stale entry);
 *  - a Grafana dashboard/alert expr references an unknown metric, or
 *    filters/groups by a label key outside the contract;
 *  - the docs contract table (docs/self-hosting/metrics.md) references an
 *    unknown metric or a label key outside the contract.
 *
 * Usage: node scripts/check-metrics.mjs (run from the repo root).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname ?? '.', '..')
const CONTRACT_FILE = 'packages/analytics/src/utils/metrics.ts'
const DOCS_FILE = 'apps/docs/src/content/docs/self-hosting/metrics.md'
const DASHBOARD_DIR = 'contrib/grafana/dashboards'
const ALERTS_FILE = 'contrib/grafana/alerts.yaml'
const CODE_DIR = 'apps/discord/src'

/** Metric name prefixes owned by external instrumentation, not our code. */
const EXTERNAL_METRIC_PREFIXES = ['nodejs_', 'v8js_']

/**
 * Label keys that never appear in the contract: Prometheus histogram bucket
 * (`le`), OTel resource attributes surfaced as target labels (`cluster_id`,
 * `service_instance_id`, `service_name`), and scrape labels.
 */
const GLOBAL_LABEL_ALLOWLIST = new Set([
  'cluster_id',
  'service_instance_id',
  'service_name',
  'le',
  'job',
  'instance',
])

const PROMQL_KEYWORDS = new Set([
  'sum',
  'avg',
  'max',
  'min',
  'count',
  'rate',
  'irate',
  'increase',
  'histogram_quantile',
  'clamp_min',
  'clamp_max',
  'topk',
  'bottomk',
  'vector',
  'or',
  'and',
  'unless',
  'by',
  'without',
  'on',
  'ignoring',
  'group_left',
  'group_right',
  'bool',
])

const errors = []
const notes = []

function fail(message) {
  errors.push(message)
}

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

/** Extract `export const NAME = { ... }` string-array map via brace scan. */
function parseContract(source, constName) {
  const anchor = `export const ${constName}`
  const start = source.indexOf(anchor)
  if (start === -1) fail(`contract ${constName} not found in ${CONTRACT_FILE}`)
  const open = source.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const body = source.slice(open, end)
  const contract = new Map()
  const entryRe =
    /['"]?([A-Za-z0-9_.-]+)['"]?\s*:\s*\[([^\]]*)\]/g
  let m
  while ((m = entryRe.exec(body)) !== null) {
    const labels = [...m[2].matchAll(/'([^']+)'/g)].map((g) => g[1])
    contract.set(m[1], labels)
  }
  return contract
}

function isExternal(name) {
  return EXTERNAL_METRIC_PREFIXES.some((p) => name.startsWith(p))
}

/** Resolve a PromQL metric token to a contract name (histogram/_total forms). */
function resolveContractName(token, contract) {
  if (contract.has(token)) return token
  for (const suffix of ['_bucket', '_count', '_sum']) {
    if (token.endsWith(suffix)) {
      const base = token.slice(0, -suffix.length)
      if (contract.has(base)) return base
    }
  }
  if (token.endsWith('_total')) {
    const base = token.slice(0, -'_total'.length)
    if (contract.has(base)) return base
  }
  return null
}

function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walkFiles(full, out)
    else if (/\.(mts|ts|mjs|js)$/.test(entry)) out.push(full)
  }
  return out
}

/** 1. Code -> contract: every created instrument must be contracted. */
function checkCode(contract, sentryContract) {
  const files = walkFiles(join(ROOT, CODE_DIR))
  const created = new Map() // name -> [files]
  const patterns = [
    /createCounter\(\s*'([^']+)'/g,
    /createHistogram\(\s*'([^']+)'/g,
    /createObservableCounter\(\s*'([^']+)'/g,
    /createObservableGauge\(\s*'([^']+)'/g,
    /createGauge\(\s*'[^']+'\s*,\s*'([^']+)'/g,
    /Sentry\.metrics\.(?:count|distribution)\(\s*'([^']+)'/g,
  ]
  for (const file of files) {
    // Contract definition itself must not count as an emitter.
    if (file.endsWith('packages/analytics/src/utils/metrics.ts')) continue
    const src = readFileSync(file, 'utf8')
    for (const re of patterns) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(src)) !== null) {
        const rel = file.slice(ROOT.length + 1)
        if (!created.has(m[1])) created.set(m[1], [])
        if (!created.get(m[1]).includes(rel)) created.get(m[1]).push(rel)
      }
    }
  }
  for (const [name, locations] of created) {
    if (name.includes('.')) {
      if (!sentryContract.has(name)) {
        fail(
          `code metric '${name}' (${locations.join(', ')}) missing from SENTRY_METRIC_CONTRACT`,
        )
      }
    } else if (!contract.has(name)) {
      fail(
        `code metric '${name}' (${locations.join(', ')}) missing from METRIC_CONTRACT`,
      )
    }
  }
  for (const name of contract.keys()) {
    if (!created.has(name)) {
      fail(`contract metric '${name}' has no emitter in ${CODE_DIR} (stale?)`)
    }
  }
  notes.push(
    `code<->contract: ${created.size} emitted metrics checked against ${contract.size} contract entries`,
  )
}

/** Collect every PromQL `expr` string from dashboard JSON + alerts YAML. */
function collectExprs() {
  const exprs = [] // {origin, expr}
  const dir = join(ROOT, DASHBOARD_DIR)
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue
    const json = JSON.parse(readFileSync(join(dir, entry), 'utf8'))
    const stack = [json]
    while (stack.length > 0) {
      const node = stack.pop()
      if (Array.isArray(node)) {
        stack.push(...node)
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (k === 'expr' && typeof v === 'string') {
            exprs.push({ origin: `${DASHBOARD_DIR}/${entry}`, expr: v })
          } else stack.push(v)
        }
      }
    }
  }
  // Minimal YAML handling: join each `expr:` value with its more-indented
  // continuation lines (covers `>-` folded blocks).
  const lines = read(ALERTS_FILE).split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)expr:\s*(.*)$/)
    if (!m) continue
    const baseIndent = m[1].length
    const parts = [m[2]]
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() !== '' &&
      !lines[i + 1].match(/^\s*\S+:/) &&
      lines[i + 1].search(/\S/) > baseIndent
    ) {
      parts.push(lines[++i].trim())
    }
    exprs.push({ origin: ALERTS_FILE, expr: parts.join(' ') })
  }
  return exprs
}

/** Find the substring inside the parens opened at `openIdx` (index of `(`). */
function parenInner(text, openIdx) {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') {
      depth--
      if (depth === 0) return text.slice(openIdx + 1, i)
    }
  }
  return ''
}

/** Validate one PromQL expr against the contract. */
function checkExpr(origin, expr, contract) {
  const tokenRe = /[a-zA-Z_:][a-zA-Z0-9_:]*/g
  const metrics = new Set()
  let m
  while ((m = tokenRe.exec(expr)) !== null) {
    const token = m[0]
    if (PROMQL_KEYWORDS.has(token)) continue
    if (token.startsWith('$') || token.startsWith('__')) continue
    if (!/^(discord_|bullmq_|framework_|process_|nodejs_|v8js_)/.test(token)) {
      continue
    }
    // Skip label names and string values: preceded by `{`, `,`, or `=`.
    // (Function-call parens like `rate(` precede real metrics; `by (key)`
    // group keys are excluded by the byOpen test below instead.)
    const prev = expr.slice(0, m.index).replace(/\s+$/, '').slice(-1)
    if (prev === '{' || prev === ',' || prev === '=') continue
    // Skip `by (label)` group keys (handled separately below).
    const before = expr.slice(0, m.index)
    const byOpen = before.match(/by\s*\(([^)]*)$/)
    if (byOpen && !byOpen[1].includes(')')) continue
    metrics.add(token)
  }

  for (const token of metrics) {
    if (isExternal(token)) continue
    const resolved = resolveContractName(token, contract)
    if (!resolved) {
      fail(`unknown metric '${token}' in ${origin}: ${expr.slice(0, 120)}`)
      continue
    }
    const allowed = new Set([
      ...contract.get(resolved),
      ...GLOBAL_LABEL_ALLOWLIST,
    ])

    // Adjacent `{...}` selector on this occurrence.
    const occRe = new RegExp(
      token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\{[^}]*\\})?',
      'g',
    )
    let om
    while ((om = occRe.exec(expr)) !== null) {
      if (om[1]) {
        for (const part of om[1].slice(1, -1).split(',')) {
          const lm = part.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|=|!=|>|<)/)
          if (lm && !allowed.has(lm[1])) {
            fail(
              `unknown label '${lm[1]}' for metric '${resolved}' in ${origin}: ${expr.slice(0, 120)}`,
            )
          }
        }
      }
    }

    // `sum by (keys) ( ... metric ... )`: grouping keys must be contract
    // labels when the metric sits inside the aggregation scope.
    const byRe = /\bby\s*\(([^)]*)\)\s*\(/g
    let bm
    while ((bm = byRe.exec(expr)) !== null) {
      const scope = parenInner(expr, bm.index + bm[0].length - 1)
      if (!scope.includes(token)) continue
      for (const key of bm[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!allowed.has(key)) {
          fail(
            `unknown group-by label '${key}' for metric '${resolved}' in ${origin}: ${expr.slice(0, 120)}`,
          )
        }
      }
    }
  }
}

/** Expand docs `prefix_last_two` / `_last` shorthand against a base name. */
function expandShorthand(first, token) {
  token = token.trim()
  if (!token.startsWith('_')) return token
  const baseSegs = first.split('_')
  const extraSegs = token.slice(1).split('_')
  return [...baseSegs.slice(0, -extraSegs.length), ...extraSegs].join('_')
}

/** 3. Docs contract table -> contract (subset: docs may omit keys). */
function checkDocs(contract) {
  const lines = read(DOCS_FILE).split('\n')
  let lastLabels = []
  let rows = 0
  for (const line of lines) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 3 || !cells[0].includes('`')) continue
    if (/^---/.test(cells[0])) continue
    const metricTokens = cells[0]
      .split('/')
      .map((s) => [...s.matchAll(/`([^`]+)`/g)].map((g) => g[1]))
      .flat()
      .filter(Boolean)
    if (metricTokens.length === 0) continue
    const first = expandShorthand(metricTokens[0], metricTokens[0])
    const metrics = metricTokens.map((t) => expandShorthand(first, t))

    let labelGroups
    // "as above" means the regular per-command set established above, not a
    // denied-specific row that happens to sit directly above (the denied
    // metric carries `identifier`; totals/errors/durations never do).
    if (/as above|same as/i.test(cells[2])) {
      labelGroups = [lastLabels]
    } else {
      const noParens = cells[2].replace(/\([^)]*\)/g, '')
      const groups = cells[2].split('/')
      if (groups.length === metrics.length && metrics.length > 1) {
        labelGroups = groups.map((g) =>
          [...g.replace(/\([^)]*\)/g, '').matchAll(/`([^`]+)`/g)].map(
            (gm) => gm[1],
          ),
        )
      } else {
        labelGroups = metrics.map(() =>
          [...noParens.matchAll(/`([^`]+)`/g)].map((g) => g[1]),
        )
      }
    }
    void first

    metrics.forEach((name, idx) => {
      if (name.includes('.') || name.includes('*')) return // runtime-instrumentation prose
      if (!contract.has(name)) {
        fail(`docs reference unknown metric '${name}' in ${DOCS_FILE}`)
        return
      }
      rows++
      const allowed = new Set(contract.get(name))
      for (const label of labelGroups[
        Math.min(idx, labelGroups.length - 1)
      ]) {
        if (!allowed.has(label)) {
          fail(
            `docs list unknown label '${label}' for metric '${name}' in ${DOCS_FILE}`,
          )
        }
      }
    })
    const shared = labelGroups[0] ?? []
    // The denied row's `identifier` must not leak into "as above" rows.
    const isDeniedRow = metrics.some((n) => n.includes('denied'))
    if (!/as above|same as/i.test(cells[2]) && !isDeniedRow) lastLabels = shared
  }
  notes.push(`docs: ${rows} metric references checked against contract`)
}

const source = read(CONTRACT_FILE)
const contract = parseContract(source, 'METRIC_CONTRACT')
const sentryContract = parseContract(source, 'SENTRY_METRIC_CONTRACT')
if (contract.size === 0) fail('METRIC_CONTRACT parsed empty — parser broken?')

checkCode(contract, sentryContract)
const exprs = collectExprs()
for (const { origin, expr } of exprs) checkExpr(origin, expr, contract)
notes.push(
  `dashboards/alerts: ${exprs.length} exprs checked against contract`,
)
checkDocs(contract)

for (const note of notes) console.log(`ok: ${note}`)
if (errors.length > 0) {
  console.error(`\nmetrics contract mismatch (${errors.length}):`)
  for (const e of [...errors].sort()) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('\nmetrics contract: all checks passed')
