import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { container } from '@sapphire/framework'
import {
  ScheduledTaskHandler,
  ScheduledTaskStore,
} from '@sapphire/plugin-scheduled-tasks'
import { silentLogger } from '@thesharks/test-utils'
import { Redis } from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { Experiments } from '../src/features/experiments.mjs'
import { FeatureFlags } from '../src/features/flags.mjs'
import { taskQueueName } from '../src/runtime/task-queue.mjs'
import { WorkScope } from '../src/runtime/work.mjs'
import { AppScheduledTask, TASK_JOB_OPTIONS } from '../src/structures/task.mjs'

class RetryTask extends AppScheduledTask {
  attempts = 0
  constructor(store: ScheduledTaskStore) {
    super(
      {
        name: 'metricsCollection',
        path: fileURLToPath(import.meta.url),
        root: dirname(fileURLToPath(import.meta.url)),
        store,
      } as never,
      { interval: 60_000, requiresShard: 0 },
    )
  }
  async run() {
    if (++this.attempts === 1) throw new Error('temporary failure')
  }
}

describe.skipIf(!process.env.REDIS_URL)('shard-owned queues in Redis', () => {
  it('retries a failed job on its owner and registers no owner-only schedule on a peer', async () => {
    const redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    })
    const work = new WorkScope()
    work.open()
    const flags = new FeatureFlags()
    container.logger = silentLogger
    container.client = Object.assign(new EventEmitter(), {
      ws: { shards: new Map([[0, {}]]) },
    }) as never
    const config = {
      identifyKeyPrefix: randomUUID(),
      sessionKeyPrefix: 'epoch-1',
      shardIds: [0],
    }
    container.app = {
      config,
      work,
      flags,
      experiments: new Experiments(flags),
    } as never
    const ownerStore = new ScheduledTaskStore()
    const task = new RetryTask(ownerStore)
    ownerStore.set(task.name, task)
    const owner = new ScheduledTaskHandler({
      queue: taskQueueName(config),
      bull: { connection: redis },
    })
    vi.spyOn(owner, 'store', 'get').mockReturnValue(ownerStore)
    config.shardIds = [1]
    const peerStore = new ScheduledTaskStore()
    const peerTask = new RetryTask(peerStore)
    peerStore.set(peerTask.name, peerTask)
    const peer = new ScheduledTaskHandler({
      queue: taskQueueName(config),
      bull: { connection: redis },
    })
    vi.spyOn(peer, 'store', 'get').mockReturnValue(peerStore)
    try {
      await peer.createRepeated()
      expect(await peer.listRepeated({})).toEqual([])
      const job = await owner.create('metricsCollection', {
        repeated: false,
        customJobOptions: {
          ...TASK_JOB_OPTIONS,
          backoff: { type: 'fixed', delay: 10 },
          removeOnComplete: false,
        },
      })
      await vi.waitFor(
        async () => expect(await job.getState()).toBe('completed'),
        { timeout: 5000 },
      )
      expect(task.attempts).toBe(2)
      expect(peerTask.attempts).toBe(0)
      await owner.createRepeated()
      expect(await owner.listRepeated({})).toHaveLength(1)
    } finally {
      await Promise.all([owner.close(), peer.close()])
      await redis.quit()
      vi.restoreAllMocks()
    }
  })
})
