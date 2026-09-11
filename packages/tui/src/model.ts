import { stripVTControlCharacters } from 'node:util'
import type {
  LocalMetricPoint,
  LocalMetricSnapshot,
} from '@thesharks/analytics'

export interface Series extends LocalMetricPoint {
  id: string
  source: string
  updatedAt: number
  rate?: number
  history: number[]
}

export interface LogLine {
  time: number
  text: string
  level: 'info' | 'warn' | 'error'
}

/** Keep untrusted log/label content from issuing terminal commands or wrapping. */
export function clean(text: string): string {
  return Array.from(stripVTControlCharacters(text), (char) => {
    const code = char.codePointAt(0) ?? 0
    return code < 32 ||
      (code >= 127 && code <= 159) ||
      code === 0x2028 ||
      code === 0x2029
      ? ' '
      : char
  }).join('')
}

export function labels(attributes: LocalMetricPoint['attributes']): string {
  return Object.entries(attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ')
}

export class DashboardModel {
  readonly sources = new Map<string, LocalMetricSnapshot>()
  readonly series = new Map<string, Series>()
  readonly logs: LogLine[] = []
  view: 'overview' | 'metrics' | 'logs' = 'overview'
  query = ''
  searching = false
  source = ''
  selected = 0
  logOffset = 0
  errorsOnly = false
  paused = false
  pausedAt?: number
  help = false

  update(source: string, snapshot: LocalMetricSnapshot): void {
    if (this.paused) return
    this.sources.set(source, snapshot)
    const seen = new Set<string>()
    for (const point of snapshot.points.slice(0, 2_000)) {
      const id = JSON.stringify([
        source,
        point.meter,
        point.name,
        Object.entries(point.attributes).sort(([a], [b]) => a.localeCompare(b)),
      ])
      seen.add(id)
      const previous = this.series.get(id)
      const elapsed = previous
        ? (snapshot.collectedAt - previous.updatedAt) / 1_000
        : 0
      if (previous && elapsed <= 0) continue
      const rate =
        point.kind === 'counter' &&
        previous &&
        elapsed > 0 &&
        point.startTime === previous.startTime &&
        point.value >= previous.value
          ? (point.value - previous.value) / elapsed
          : undefined
      const history = [
        ...(previous?.history ?? []),
        point.kind === 'counter' ? (rate ?? 0) : point.value,
      ].slice(-60)
      this.series.set(id, {
        ...point,
        id,
        source,
        updatedAt: snapshot.collectedAt,
        rate,
        history,
      })
    }
    for (const [id, point] of this.series) {
      if (point.source === source && !seen.has(id)) this.series.delete(id)
    }
  }

  removeSource(source: string): void {
    this.sources.delete(source)
    for (const [id, point] of this.series) {
      if (point.source === source) this.series.delete(id)
    }
    if (this.source === source) this.source = ''
  }

  addLog(text: string, stderr = false): void {
    if (this.paused) return
    const message = clean(text).slice(0, 4_096)
    if (!message.trim()) return
    const level = /\b(error|fatal)\b/i.test(message)
      ? 'error'
      : stderr || /\bwarn(ing)?\b/i.test(message)
        ? 'warn'
        : 'info'
    this.logs.push({ time: Date.now(), text: message, level })
    if (
      this.logOffset > 0 &&
      (!this.errorsOnly || level !== 'info') &&
      message.toLowerCase().includes(this.query.toLowerCase())
    )
      this.logOffset++
    if (this.logs.length > 1_000) this.logs.shift()
  }

  metrics(): Series[] {
    const query = this.query.toLowerCase()
    return [...this.series.values()]
      .filter(
        (point) =>
          (!this.source || point.source === this.source) &&
          `${point.name} ${point.meter} ${labels(point.attributes)} ${point.source}`
            .toLowerCase()
            .includes(query),
      )
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          a.source.localeCompare(b.source) ||
          a.id.localeCompare(b.id),
      )
  }

  filteredLogs(): LogLine[] {
    return this.logs.filter(
      (line) =>
        (!this.errorsOnly || line.level !== 'info') &&
        line.text.toLowerCase().includes(this.query.toLowerCase()),
    )
  }

  key(
    text: string,
    key: { name?: string; ctrl?: boolean; shift?: boolean },
  ): 'detach' | 'shutdown' | undefined {
    if (key.ctrl && key.name === 'c') return 'shutdown'
    if (this.searching) {
      if (key.name === 'escape') {
        this.searching = false
        this.query = ''
      } else if (key.name === 'return') this.searching = false
      else if (key.name === 'backspace') this.query = this.query.slice(0, -1)
      else if (!key.ctrl && text && clean(text) === text)
        this.query = (this.query + text).slice(0, 100)
      this.selected = 0
      this.logOffset = 0
      return
    }
    if (text === 'q') return 'detach'
    if (text === '?') this.help = !this.help
    if (text === ' ') {
      this.paused = !this.paused
      this.pausedAt = this.paused ? Date.now() : undefined
    }
    if (text === '/') this.searching = true
    if (key.name === 'escape') {
      this.query = ''
      this.help = false
    }
    const views = ['overview', 'metrics', 'logs'] as const
    if (key.name === 'tab')
      this.view = views[(views.indexOf(this.view) + (key.shift ? 2 : 1)) % 3]
    if (['1', '2', '3'].includes(text)) this.view = views[Number(text) - 1]
    if (text === 's' && this.view !== 'logs') {
      const sources = ['', ...this.sources.keys()].sort()
      this.source = sources[(sources.indexOf(this.source) + 1) % sources.length]
      this.selected = 0
    }
    if (text === 'e' && this.view === 'logs') {
      this.errorsOnly = !this.errorsOnly
      this.logOffset = 0
    }
    const direction =
      key.name === 'up' || text === 'k'
        ? -1
        : key.name === 'down' || text === 'j'
          ? 1
          : 0
    const page =
      key.name === 'pageup' ? -10 : key.name === 'pagedown' ? 10 : direction
    if (this.view === 'metrics')
      this.selected = Math.max(
        0,
        Math.min(this.metrics().length - 1, this.selected + page),
      )
    if (this.view === 'logs')
      this.logOffset = Math.max(
        0,
        Math.min(this.filteredLogs().length - 1, this.logOffset - page),
      )
    if (key.name === 'end') {
      this.logOffset = 0
      this.selected = Math.max(0, this.metrics().length - 1)
    }
    if (key.name === 'home') {
      this.logOffset = Math.max(0, this.filteredLogs().length - 1)
      this.selected = 0
    }
  }
}
