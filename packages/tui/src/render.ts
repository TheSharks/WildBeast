import stringWidth from 'string-width'
import { clean, type DashboardModel, labels, type Series } from './model.js'

const cyan = '\x1b[36m'
const muted = '\x1b[90m'
const reset = '\x1b[0m'
const bold = '\x1b[1m'

export function format(value: number | undefined, unit = ''): string {
  if (value === undefined || !Number.isFinite(value)) return '--'
  if (unit === 'By' || unit === 'bytes') {
    if (Math.abs(value) >= 1_048_576)
      return `${(value / 1_048_576).toFixed(1)} MiB`
    return `${(value / 1_024).toFixed(1)} KiB`
  }
  if (unit === 's')
    return value < 1
      ? `${(value * 1_000).toFixed(1)} ms`
      : `${value.toFixed(2)} s`
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2, notation: Math.abs(value) >= 1e6 ? 'compact' : 'standard' }).format(value)}${unit ? ` ${unit}` : ''}`
}

export function sparkline(values: number[]): string {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const bars = '▁▂▃▄▅▆▇█'
  return values
    .map(
      (value) =>
        bars[max === min ? 0 : Math.round(((value - min) / (max - min)) * 7)],
    )
    .join('')
}

export interface DashboardStatus {
  title: string
  phase: string
  startedAt: number
  shards: { id: number; status: string }[]
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

/** Clip whole graphemes by terminal cells, including wide glyphs and emoji. */
function fit(text: string, width: number): string {
  let result = ''
  let used = 0
  for (const { segment } of segmenter.segment(clean(text))) {
    const cells = stringWidth(segment)
    if (used + cells > width) break
    result += segment
    used += cells
  }
  return result + ' '.repeat(width - used)
}

/** Workers observe the same Redis queue: take one latest observation per queue. */
export function queueTotal(points: Series[], name: string): number | undefined {
  const queues = new Map<string, Series>()
  for (const point of points) {
    if (point.name !== name) continue
    const queue = String(point.attributes.queue_name ?? '')
    const previous = queues.get(queue)
    if (!previous || point.updatedAt > previous.updatedAt)
      queues.set(queue, point)
  }
  return queues.size
    ? [...queues.values()].reduce((sum, p) => sum + p.value, 0)
    : undefined
}

/** A complete frame, including clearing leftover lines after terminal resizing. */
export function render(
  model: DashboardModel,
  status: DashboardStatus,
  columns: number,
  rows: number,
  now = Date.now(),
): string {
  now = model.pausedAt ?? now
  const width = Math.max(1, columns - 1)
  const height = Math.max(1, rows)
  const lines: string[] = []
  const line = (text = '', style = '') =>
    lines.push(`${style}${fit(text, width)}${reset}`)
  const rule = () => line('─'.repeat(width), muted)
  const section = (title: string) => {
    rule()
    line(title, cyan + bold)
  }
  line(` WILDBEAST / ${status.title}`, bold + cyan)
  line(
    ` ${model.paused ? 'PAUSED' : 'LIVE'}  ${status.phase.toUpperCase()}  |  up ${Math.floor((now - status.startedAt) / 60_000)}m  |  ${status.shards.filter((s) => s.status === 'ready').length}/${status.shards.length} shards ready`,
  )
  line(
    ` ${model.view === 'overview' ? '[1 Overview]' : ' 1 Overview '}  ${model.view === 'metrics' ? '[2 Metrics]' : ' 2 Metrics '}  ${model.view === 'logs' ? '[3 Logs]' : ' 3 Logs '}`,
    bold,
  )
  line(
    ` ${model.view === 'logs' ? `${model.errorsOnly ? 'Warnings/errors' : 'All levels'} | ${model.logs.length}/1000 buffered` : `Source: ${model.source || 'all local sources'} | ${model.series.size} series`}  |  / ${model.query}${model.searching ? '_' : ''}`,
    muted,
  )
  rule()
  if (width < 50 || height < 16) {
    line(' Terminal too small. Resize to at least 51 x 16.')
  } else if (model.help) {
    for (const text of [
      ' KEYBOARD',
      '',
      ' 1 / 2 / 3 or Tab    Switch views',
      ' Up / Down or j/k   Select metric / scroll logs',
      ' PgUp / PgDn        Move ten rows',
      ' Home / End         First / last metric; oldest / live logs',
      ' /                  Search metric names, labels, or logs',
      ' Enter / Esc        Finish search / clear filter',
      ' s                  Cycle metric source',
      ' e                  Toggle warnings/errors in Logs',
      ' Space              Freeze display (incoming samples/logs skipped)',
      ' q                  Return to plain logs; bot keeps running',
      ' Ctrl+C             Gracefully stop the bot',
      ' ?                  Toggle this help',
    ])
      line(text)
  } else if (model.view === 'overview') {
    const points = [...model.series.values()].filter(
      (p) =>
        (!model.source || p.source === model.source) &&
        now - p.updatedAt < 10_000,
    )
    const sum = (name: string) => {
      const matching = points.filter((p) => p.name === name)
      return matching.length
        ? matching.reduce((total, p) => total + p.value, 0)
        : undefined
    }
    const commands = points.filter((p) => p.name === 'discord_commands_total')
    const rate = commands.filter((p) => p.rate !== undefined)
    line(' ACTIVITY  /  current local workers', bold)
    line(
      ` Commands  ${format(sum('discord_commands_total'))}  |  ${format(rate.length ? rate.reduce((n, p) => n + (p.rate ?? 0), 0) : undefined)}/s  |  command errors  ${format(sum('discord_command_errors_total'))}`,
    )
    line(
      ` Guilds    ${format(sum('discord_guilds_total'))}  |  queued jobs  ${format(queueTotal(points, 'bullmq_queue_waiting'))}  |  failed jobs  ${format(queueTotal(points, 'bullmq_queue_failed'))}`,
    )
    const latency = points.filter(
      (p) => p.name === 'discord_websocket_latency_seconds',
    )
    line(
      ` Gateway   ${format(latency.length ? Math.max(...latency.map((p) => p.value)) : undefined, 's')} max latency  |  epoch ${format(sum('discord_cluster_epoch'))}`,
    )
    section(' SHARDS / LOCAL SOURCES')
    if (!status.shards.length) line(' Waiting for shard workers...')
    for (const shard of status.shards.slice(
      0,
      Math.max(1, Math.floor((height - 18) / 2)),
    )) {
      const source = model.sources.get(`shard:${shard.id}`)
      line(
        ` #${String(shard.id).padEnd(4)} ${shard.status.padEnd(14)} ${source ? `sample ${Math.max(0, Math.floor((now - source.collectedAt) / 1_000))}s ago${now - source.collectedAt >= 10_000 ? ' (STALE)' : ''}` : 'awaiting metrics'}`,
      )
    }
    section(' RECENT LOGS')
    for (const log of model.logs.slice(-Math.max(1, height - lines.length - 2)))
      line(
        ` ${log.text}`,
        log.level === 'error'
          ? '\x1b[31m'
          : log.level === 'warn'
            ? '\x1b[33m'
            : '',
      )
  } else if (model.view === 'metrics') {
    const points = model.metrics()
    model.selected = Math.max(0, Math.min(model.selected, points.length - 1))
    const selected = points[model.selected]
    const count = Math.max(1, height - 17)
    const start = Math.max(0, model.selected - count + 1)
    line(
      ` METRICS  ${points.length ? model.selected + 1 : 0}/${points.length} matching series`,
      bold,
    )
    const nameWidth = Math.max(16, width - 35)
    line(`   ${'NAME'.padEnd(nameWidth)} ${'SOURCE'.padEnd(10)} VALUE`, muted)
    for (const point of points.slice(start, start + count)) {
      line(
        ` ${point === selected ? '>' : ' '} ${point.name.slice(0, nameWidth).padEnd(nameWidth)} ${point.source.slice(0, 10).padEnd(10)} ${format(point.value, point.unit)}`,
        point === selected ? '\x1b[7m' : '',
      )
    }
    if (!selected)
      line(' No matching samples yet. Clear / filter or wait for collection.')
    while (lines.length < 8 + count) line()
    if (selected) {
      section(` ${selected.name}`)
      line(` ${selected.description}`, muted)
      line(
        ` ${selected.kind} | ${selected.source} | ${labels(selected.attributes) || 'no labels'}`,
      )
      line(
        ` ${detail(selected)}${now - selected.updatedAt >= 10_000 ? ' | STALE' : ''}`,
      )
      const trend = sparkline(selected.history.slice(-Math.max(1, width - 10)))
      line(` ${trend}`, cyan)
      line(
        ` Trend: ${selected.kind === 'counter' ? 'per-second rate' : selected.kind === 'histogram' ? 'cumulative mean' : 'value'}, last ${selected.history.length} samples; auto-scaled`,
        muted,
      )
    }
  } else {
    const logs = model.filteredLogs()
    const count = Math.max(1, height - 9)
    model.logOffset = Math.min(model.logOffset, Math.max(0, logs.length - 1))
    const end = logs.length - model.logOffset
    line(
      ` LOGS  ${logs.length} matching | ${model.logOffset ? `${model.logOffset} lines behind live` : 'following live'}`,
      bold,
    )
    for (const log of logs.slice(Math.max(0, end - count), end))
      line(
        ` ${new Date(log.time).toISOString().slice(11, 19)} ${log.text}`,
        log.level === 'error'
          ? '\x1b[31m'
          : log.level === 'warn'
            ? '\x1b[33m'
            : '',
      )
    if (!logs.length) line(' No matching log lines.')
  }
  const issues = [...model.sources.entries()].filter(
    ([, snapshot]) => snapshot.errors || snapshot.truncated,
  )
  const footer = model.searching
    ? ' Type to filter | Enter apply | Esc clear'
    : `${issues.length ? ' (!) Partial metrics |' : ''} Tab views | / search | Space pause | ? help | q detach | Ctrl+C stop`
  const body = lines.slice(0, Math.max(0, height - 1))
  while (body.length < height - 1) body.push('\x1b[K')
  body.push(`${muted}${fit(footer, width)}${reset}`)
  return `\x1b[H${body.join('\r\n')}\x1b[J`
}

function detail(point: Series): string {
  if (point.kind === 'counter')
    return `Total ${format(point.value)} | Rate ${format(point.rate)}/s`
  if (point.kind === 'histogram')
    return `Count ${format(point.count)} | Mean ${format(point.count ? point.value : undefined, point.unit)} | Min ${format(point.min, point.unit)} | Max ${format(point.max, point.unit)}`
  return `Value ${format(point.value, point.unit)} | Window min ${format(Math.min(...point.history), point.unit)} / max ${format(Math.max(...point.history), point.unit)}`
}
