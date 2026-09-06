import { describe, expect, it } from 'vitest'
import {
  ApplicationRuntime,
  type ResourceFactory,
} from '../src/runtime/application.mjs'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function factories(events: string[]): ResourceFactory[] {
  return ['database', 'sessions', 'gateway'].map((name) => ({
    name,
    open: async () => {
      events.push(`open:${name}`)
      return {
        close: async (reason) => {
          events.push(`close:${name}:${reason}`)
        },
      }
    },
  }))
}

describe('replacement runtime lifecycle', () => {
  it('accepts work only after startup and joins repeated shutdown requests', async () => {
    const events: string[] = []
    const app = new ApplicationRuntime(factories(events))
    await expect(app.work.run(async () => 1)).rejects.toThrow('not accepting')
    await app.start()
    expect(app.phase).toBe('ready')
    await expect(app.work.run(async () => 1)).resolves.toBe(1)
    const stop = app.stop('handoff')
    expect(app.stop('shutdown')).toBe(stop)
    await expect(app.work.run(async () => 2)).rejects.toThrow('not accepting')
    await stop
    expect(events).toEqual([
      'open:database',
      'open:sessions',
      'open:gateway',
      'close:gateway:handoff',
      'close:sessions:handoff',
      'close:database:handoff',
    ])
    expect(app.phase).toBe('stopped')
    await expect(app.start()).rejects.toThrow('cannot restart')
  })

  it('unwinds successful acquisitions when startup fails', async () => {
    const events: string[] = []
    const resources = factories(events)
    resources[2]!.open = async () => {
      throw new Error('login failed')
    }
    const app = new ApplicationRuntime(resources)
    await expect(app.start()).rejects.toThrow('startup failed')
    expect(events).toEqual([
      'open:database',
      'open:sessions',
      'close:sessions:startup-failed',
      'close:database:startup-failed',
    ])
    await app.stop('shutdown')
    expect(events).toHaveLength(4)
  })

  it('waits for late acquisitions when stopped during startup', async () => {
    const gate = deferred()
    const events: string[] = []
    const app = new ApplicationRuntime([
      {
        name: 'database',
        open: async () => {
          await gate.promise
          return {
            close: async () => {
              events.push('closed')
            },
          }
        },
      },
    ])
    const start = app.start()
    const rejected = expect(start).rejects.toThrow('startup failed')
    const stop = app.stop('shutdown')
    gate.resolve()
    await rejected
    await stop
    expect(events).toEqual(['closed'])
    expect(app.phase).toBe('stopped')
  })

  it('drains admitted work before closing its resources', async () => {
    const gate = deferred()
    const events: string[] = []
    const app = new ApplicationRuntime(factories(events))
    await app.start()
    const work = app.work.run(async (signal) => {
      await gate.promise
      expect(signal.aborted).toBe(true)
      events.push('work-finished')
    })
    const stop = app.stop('shutdown')
    await Promise.resolve()
    expect(events).toHaveLength(3)
    gate.resolve()
    await work
    await stop
    expect(events[3]).toBe('work-finished')
  })

  it('does not close storage under hung work when drain expires', async () => {
    const gate = deferred()
    const events: string[] = []
    const app = new ApplicationRuntime(factories(events), 5)
    await app.start()
    const work = app.work.run(async () => gate.promise)
    await expect(app.stop('shutdown')).rejects.toThrow('drain deadline')
    expect(events).toHaveLength(3)
    expect(app.phase).toBe('failed')
    gate.resolve()
    await work
  })

  it('closes remaining resources even if one close fails', async () => {
    const events: string[] = []
    const resources = factories(events)
    resources[2]!.open = async () => ({
      close: async () => {
        throw new Error('gateway failed')
      },
    })
    const app = new ApplicationRuntime(resources)
    await app.start()
    await expect(app.stop('shutdown')).rejects.toThrow('teardown failed')
    expect(events.slice(-2)).toEqual([
      'close:sessions:shutdown',
      'close:database:shutdown',
    ])
  })
})
