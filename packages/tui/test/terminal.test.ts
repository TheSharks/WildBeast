import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canStartDashboard, startDashboard } from '../src/index.js'

let stop: (() => void) | undefined

afterEach(() => {
  stop?.()
  stop = undefined
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

function terminal(tty = true) {
  vi.useFakeTimers()
  vi.stubEnv('TERM', 'xterm-256color')
  vi.stubEnv('CI', '')
  const input = Object.assign(new PassThrough(), {
    isTTY: tty,
    isRaw: false,
    setRawMode(raw: boolean) {
      this.isRaw = raw
      return this
    },
  })
  let screen = ''
  const output = Object.assign(new PassThrough(), {
    isTTY: tty,
    columns: 100,
    rows: 30,
  })
  output.on('data', (data) => {
    screen += String(data)
  })
  const error = new PassThrough()
  vi.spyOn(process, 'stdin', 'get').mockReturnValue(input as never)
  vi.spyOn(process, 'stdout', 'get').mockReturnValue(output as never)
  vi.spyOn(process, 'stderr', 'get').mockReturnValue(error as never)
  return { input, output, error, screen: () => screen }
}

const status = () => ({
  title: 'test',
  phase: 'serving',
  startedAt: 0,
  shards: [],
})
const snapshot = { collectedAt: 1_000, points: [], errors: 0, truncated: false }

describe('terminal ownership', () => {
  it('leaves redirected output and stdin untouched', () => {
    const { output, screen } = terminal(false)
    const original = output.write
    const sample = vi.fn().mockResolvedValue(snapshot)
    expect(canStartDashboard('on')).toBe(false)
    expect(
      startDashboard({ status, sample, onShutdown: vi.fn() }),
    ).toBeUndefined()
    expect(output.write).toBe(original)
    expect(screen()).toBe('')
    expect(sample).not.toHaveBeenCalled()
  })

  it('restores streams, raw mode and listeners on detach; callbacks still complete', async () => {
    const { input, output, error, screen } = terminal()
    const originalOut = output.write
    const originalErr = error.write
    const detach = vi.fn()
    const shutdown = vi.fn()
    const beforeExit = process.listenerCount('exit')
    const ui = startDashboard({
      status,
      sample: async () => snapshot,
      onShutdown: shutdown,
      onDetach: detach,
    })
    stop = ui?.stop
    expect(input.isRaw).toBe(true)
    const callback = vi.fn()
    output.write('partial ')
    output.write('line\n', callback)
    error.write('ERROR failure\n')
    await Promise.resolve()
    expect(callback).toHaveBeenCalledOnce()
    expect(ui?.model.logs.map((log) => log.text)).toEqual([
      'partial line',
      'ERROR failure',
    ])
    input.emit('keypress', 'q', { name: 'q' })
    ui?.stop()
    expect(input.isRaw).toBe(false)
    expect(input.isPaused()).toBe(true)
    expect(output.write).toBe(originalOut)
    expect(error.write).toBe(originalErr)
    expect(input.listenerCount('keypress')).toBe(0)
    expect(process.listenerCount('exit')).toBe(beforeExit)
    expect(vi.getTimerCount()).toBe(0)
    expect(detach).toHaveBeenCalledOnce()
    expect(shutdown).not.toHaveBeenCalled()
    expect(screen()).toContain('\x1b[?1049h')
    expect(screen()).toContain('\x1b[?25h\x1b[?1049l')
    expect(screen()).toContain('ERROR failure\n')
  })

  it('serializes sampling and ignores in-flight results after graceful shutdown', async () => {
    const { input } = terminal()
    let resolve!: (value: typeof snapshot) => void
    const sample = vi.fn(
      () =>
        new Promise<typeof snapshot>((done) => {
          resolve = done
        }),
    )
    const shutdown = vi.fn()
    const ui = startDashboard({ status, sample, onShutdown: shutdown })
    stop = ui?.stop
    await vi.advanceTimersByTimeAsync(6_000)
    expect(sample).toHaveBeenCalledOnce()
    input.emit('keypress', '\x03', { name: 'c', ctrl: true })
    expect(shutdown).toHaveBeenCalledOnce()
    expect(input.isRaw).toBe(false)
    resolve(snapshot)
    await Promise.resolve()
    expect(ui?.model.sources.size).toBe(0)
  })

  it('honors explicit off, CI auto mode and dumb terminals', () => {
    terminal()
    expect(canStartDashboard('off')).toBe(false)
    vi.stubEnv('CI', '1')
    expect(canStartDashboard()).toBe(false)
    expect(canStartDashboard('on')).toBe(true)
    vi.stubEnv('TERM', 'dumb')
    expect(canStartDashboard('on')).toBe(false)
  })
})
