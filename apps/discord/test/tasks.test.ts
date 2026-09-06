import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container } from '@sapphire/framework'
import {
  type ScheduledTask,
  ScheduledTaskStore,
} from '@sapphire/plugin-scheduled-tasks'
import { silentLogger } from '@thesharks/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Experiments } from '../src/features/experiments.mjs'
import { FeatureFlags } from '../src/features/flags.mjs'
import { WorkScope } from '../src/runtime/work.mjs'
import { AppScheduledTask, TaskDeferred } from '../src/structures/task.mjs'

class FixtureTask extends AppScheduledTask {
  public runs = 0
  public constructor(requiresShard?: number) {
    super(
      {
        name: 'metricsCollection',
        path: fileURLToPath(import.meta.url),
        root: dirname(fileURLToPath(import.meta.url)),
        store: new ScheduledTaskStore(),
      } as never,
      {
        interval: 60_000,
        ...(requiresShard !== undefined ? { requiresShard } : {}),
      } as ScheduledTask.Options,
    )
  }
  public run() {
    this.runs += 1
    return 'ran'
  }
}

const shards = new Map<number, unknown>()
container.client = Object.assign(new EventEmitter(), {
  options: {},
  ws: { shards },
}) as never
container.logger = silentLogger

let work: WorkScope
let flags: FeatureFlags

beforeEach(() => {
  work = new WorkScope()
  work.open()
  flags = new FeatureFlags()
  container.app = { work, flags, experiments: new Experiments(flags) } as never
  shards.clear()
  shards.set(0, {})
})

describe('replacement scheduled tasks', () => {
  it('runs the body through the work scope with retrying job options', async () => {
    const task = new FixtureTask()
    await expect(task.run(undefined as never)).resolves.toBe('ran')
    expect(task.customJobOptions?.attempts).toBeGreaterThan(1)
  })

  it('defers instead of running once the runtime stops accepting work', async () => {
    const task = new FixtureTask()
    work.close()
    await expect(task.run(undefined as never)).rejects.toBeInstanceOf(
      TaskDeferred,
    )
    expect(task.runs).toBe(0)
  })

  it('defers cluster-dependent work on a worker that does not own the shard', async () => {
    const task = new FixtureTask(0)
    await expect(task.run(undefined as never)).resolves.toBe('ran')
    shards.clear()
    shards.set(3, {})
    await expect(task.run(undefined as never)).rejects.toThrow(
      'requires shard 0',
    )
    expect(task.runs).toBe(1)
  })

  it('skips the body when the task gate is off', async () => {
    vi.spyOn(flags, 'enabled').mockResolvedValueOnce(false)
    const task = new FixtureTask()
    await expect(task.run(undefined as never)).resolves.toBeUndefined()
    expect(task.runs).toBe(0)
  })
})
