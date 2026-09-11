import { emitKeypressEvents } from 'node:readline'
import { StringDecoder } from 'node:string_decoder'
import type { LocalMetricSnapshot } from '@thesharks/analytics'
import { DashboardModel } from './model.js'
import { type DashboardStatus, render } from './render.js'

export { DashboardModel } from './model.js'
export { type DashboardStatus, render } from './render.js'

export function canStartDashboard(mode = 'auto'): boolean {
  return (
    mode !== 'off' &&
    Boolean(process.stdin.isTTY && process.stdout.isTTY) &&
    process.env.TERM !== 'dumb' &&
    (mode === 'on' || !process.env.CI)
  )
}

export interface DashboardOptions {
  status: () => DashboardStatus
  sample: () => Promise<LocalMetricSnapshot>
  sampleSource?: string
  onShutdown: () => void
  onDetach?: () => void
}

/** Owns the terminal only until stop(); non-TTY streams are never modified. */
export function startDashboard(options: DashboardOptions) {
  const model = new DashboardModel()
  if (!canStartDashboard('on')) return undefined
  const input = process.stdin
  const output = process.stdout
  const originalOut = output.write
  const originalErr = process.stderr.write
  const write = originalOut.bind(output)
  const wasRaw = input.isRaw
  const wasFlowing = input.readableFlowing
  let stopped = false
  let collecting = false
  let drawing = false
  let blocked = false

  const draw = () => {
    if (stopped || drawing || blocked) return
    drawing = true
    try {
      blocked = !write(
        render(
          model,
          options.status(),
          output.columns || 80,
          output.rows || 24,
        ),
      )
    } finally {
      drawing = false
    }
  }
  const drain = () => {
    blocked = false
  }
  output.on('drain', drain)

  const captures: { flush: () => void }[] = []
  const capture = (stderr: boolean): typeof output.write => {
    const decoder = new StringDecoder('utf8')
    let pending = ''
    captures.push({
      flush: () => {
        if (pending) {
          model.addLog(pending, stderr)
          pending = ''
        }
      },
    })
    return (chunk, encodingOrCallback?, callback?) => {
      const text =
        typeof chunk === 'string' ? chunk : decoder.write(Buffer.from(chunk))
      pending += text
      let newline = pending.indexOf('\n')
      while (newline >= 0) {
        model.addLog(pending.slice(0, newline), stderr)
        pending = pending.slice(newline + 1)
        newline = pending.indexOf('\n')
      }
      if (pending.length > 4_096) {
        model.addLog(pending, stderr)
        pending = ''
      }
      const done =
        typeof encodingOrCallback === 'function' ? encodingOrCallback : callback
      if (typeof done === 'function') queueMicrotask(() => done())
      return true
    }
  }

  const sample = async () => {
    if (collecting || stopped || model.paused) return
    collecting = true
    try {
      const snapshot = await options.sample()
      if (!stopped) model.update(options.sampleSource ?? 'manager', snapshot)
    } catch (error) {
      if (!stopped)
        model.addLog(`Metrics collection failed: ${String(error)}`, true)
    } finally {
      collecting = false
    }
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    clearInterval(frames)
    clearInterval(samples)
    input.off('keypress', keypress)
    output.off('resize', draw)
    output.off('drain', drain)
    process.off('exit', stop)
    process.off('uncaughtExceptionMonitor', stop)
    output.write = originalOut
    process.stderr.write = originalErr
    input.setRawMode(wasRaw)
    if (wasFlowing !== true) input.pause()
    write('\x1b[0m\x1b[?25h\x1b[?1049l')
    for (const capture of captures) capture.flush()
    // Preserve recent context when returning to normal logs (including failures).
    for (const log of model.logs.slice(-20)) write(`${log.text}\n`)
    options.onDetach?.()
  }
  const keypress = (
    text: string | undefined,
    key: { name?: string; ctrl?: boolean; shift?: boolean },
  ) => {
    const action = model.key(text ?? '', key)
    if (action) {
      stop()
      if (action === 'shutdown') options.onShutdown()
    } else draw()
  }
  const frames = setInterval(draw, 250)
  const samples = setInterval(() => void sample(), 2_000)
  frames.unref()
  samples.unref()
  process.on('exit', stop)
  process.on('uncaughtExceptionMonitor', stop)
  emitKeypressEvents(input)
  input.on('keypress', keypress)
  input.setRawMode(true)
  input.resume()
  output.on('resize', draw)
  output.write = capture(false)
  process.stderr.write = capture(true)
  write('\x1b[?1049h\x1b[?25l\x1b[2J')
  draw()
  void sample()
  return { model, stop }
}
