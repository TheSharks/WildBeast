import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  Command,
  CommandStore,
  container,
  Listener,
  ListenerStore,
  type Piece,
  Precondition,
  PreconditionStore,
} from '@sapphire/framework'
import {
  ScheduledTask,
  ScheduledTaskStore,
} from '@sapphire/plugin-scheduled-tasks'
import { silentLogger } from '@thesharks/test-utils'
import { Collection } from 'discord.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { commandGateKey, taskGateKey } from '../src/features/registry.mjs'

/**
 * Load the replacement's compiled pieces through real Sapphire stores and
 * verify every exported piece registers exactly once with its wrappers.
 */
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const fakeClient = Object.assign(new EventEmitter(), {
  rest: new EventEmitter(),
  options: {},
  guilds: { cache: new Collection() },
  channels: { cache: new Collection() },
})
fakeClient.setMaxListeners(256)
container.client = fakeClient as never
container.logger = silentLogger

const listenerStore = new ListenerStore()
const commandStore = new CommandStore()
const preconditionStore = new PreconditionStore()
const taskStore = new ScheduledTaskStore()

async function exportedPieceCount(
  dir: string,
  base: abstract new (
    // biome-ignore lint/suspicious/noExplicitAny: matching any constructor
    ...args: any[]
  ) => Piece,
): Promise<number> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  let count = 0
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue
    const module = await import(
      pathToFileURL(join(entry.parentPath, entry.name)).href
    )
    for (const value of Object.values(module)) {
      if (typeof value === 'function' && value.prototype instanceof base)
        count += 1
    }
  }
  return count
}

beforeAll(async () => {
  if (!existsSync(dist)) throw new Error('dist is missing: run pnpm build')
  await listenerStore.registerPath(join(dist, 'listeners')).loadAll()
  await commandStore.registerPath(join(dist, 'commands')).loadAll()
  await preconditionStore.registerPath(join(dist, 'preconditions')).loadAll()
  await taskStore.registerPath(join(dist, 'scheduled-tasks')).loadAll()
})

describe('replacement piece loading', () => {
  it('registers every exported listener exactly once, bound to an event', async () => {
    const exported = await exportedPieceCount(join(dist, 'listeners'), Listener)
    expect(exported).toBeGreaterThan(0)
    expect(listenerStore.size).toBe(exported)
    for (const listener of listenerStore.values()) {
      expect(listener.enabled, listener.name).toBe(true)
      expect(listener.event, listener.name).toBeTruthy()
      expect(listener.emitter, listener.name).toBeTruthy()
    }
  })

  it('registers every command with a runtime gate and admitted, traced handlers', async () => {
    const exported = await exportedPieceCount(join(dist, 'commands'), Command)
    expect(exported).toBeGreaterThan(0)
    expect(commandStore.size).toBe(exported)
    for (const command of commandStore.values()) {
      expect(commandGateKey(command.name), command.name).toBeDefined()
      expect(Object.hasOwn(command, 'chatInputRun'), command.name).toBe(true)
      const scoped = command as unknown as { scope: string }
      if (scoped.scope === 'operator') {
        // Never bulk-registered: operator commands are placed per guild.
        expect(command.applicationCommandRegistry.chatInputCommands.size).toBe(
          0,
        )
        expect(
          command.preconditions.entries.some(
            (entry) => 'name' in entry && entry.name === 'OwnerOnly',
          ),
          `${command.name} should carry the OwnerOnly gate`,
        ).toBe(true)
      }
      expect(
        command.preconditions.entries.some(
          (entry) => 'name' in entry && entry.name === 'Feature',
        ),
        `${command.name} should carry the Feature gate`,
      ).toBe(true)
    }
  })

  it('registers the gate, premium and owner preconditions', async () => {
    const exported = await exportedPieceCount(
      join(dist, 'preconditions'),
      Precondition,
    )
    expect(preconditionStore.size).toBe(exported)
    expect([...preconditionStore.keys()].sort()).toEqual([
      'Feature',
      'OwnerOnly',
      'Premium',
    ])
  })

  it('registers every scheduled task with a schedule, a gate and the admitted wrapper', async () => {
    const exported = await exportedPieceCount(
      join(dist, 'scheduled-tasks'),
      ScheduledTask,
    )
    expect(exported).toBeGreaterThan(0)
    expect(taskStore.size).toBe(exported)
    for (const task of taskStore.values()) {
      expect(task.interval ?? task.pattern, task.name).toBeTruthy()
      expect(taskGateKey(task.name), task.name).toBeDefined()
      expect(Object.hasOwn(task, 'run'), task.name).toBe(true)
      expect(task.customJobOptions?.attempts, task.name).toBeGreaterThan(1)
    }
  })

  it('does not load any piece from the baseline application', () => {
    for (const store of [
      listenerStore,
      commandStore,
      preconditionStore,
      taskStore,
    ]) {
      for (const piece of store.values()) {
        expect(piece.location.full.startsWith(dist), piece.name).toBe(true)
      }
    }
  })
})
