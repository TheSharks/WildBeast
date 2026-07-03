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
} from '@sapphire/framework'
import {
  ScheduledTask,
  ScheduledTaskStore,
} from '@sapphire/plugin-scheduled-tasks'
import { SpanStatusCode } from '@thesharks/analytics'
import { captureSpans, silentLogger } from '@thesharks/test-utils'
import { Collection } from 'discord.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { TracedCommand } from '../src/structures/command.mjs'
import { TracedScheduledTask } from '../src/structures/task.mjs'

/**
 * Framework structure tests: load the app's compiled pieces through real
 * Sapphire stores (no Discord login) and verify the loading invariants —
 * most importantly that every exported piece actually registers. Sapphire
 * silently unloads a piece when another one with the same name is inserted
 * (names default to the file name), which once cost us most of the metrics
 * listeners.
 */
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const spanCapture = captureSpans()

const fakeRest = new EventEmitter()
fakeRest.setMaxListeners(64)
const fakeClient = new EventEmitter()
fakeClient.setMaxListeners(256)
Object.assign(fakeClient, {
  rest: fakeRest,
  options: {},
  guilds: { cache: new Collection() },
  channels: { cache: new Collection() },
  ws: { ping: 42 },
})

// Pieces read the container during construction (e.g. the cooldown
// precondition parser reads client options), so stub it before anything
// instantiates.
container.client = fakeClient as never
container.logger = silentLogger

const listenerStore = new ListenerStore()
const taskStore = new ScheduledTaskStore()
const commandStore = new CommandStore()

/** Count classes extending `base` across all compiled modules in `dir`. */
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
      if (typeof value === 'function' && value.prototype instanceof base) {
        count += 1
      }
    }
  }
  return count
}

beforeAll(async () => {
  if (!existsSync(dist)) {
    throw new Error(
      'dist/ is missing — run `pnpm build` first (turbo test does this automatically)',
    )
  }

  await listenerStore.registerPath(join(dist, 'listeners')).loadAll()
  await taskStore.registerPath(join(dist, 'scheduled-tasks')).loadAll()
  await commandStore.registerPath(join(dist, 'commands')).loadAll()
})

describe('piece loading', () => {
  it('registers every exported listener exactly once', async () => {
    const exported = await exportedPieceCount(join(dist, 'listeners'), Listener)
    expect(exported).toBeGreaterThan(0)
    // A mismatch means a name collision silently unloaded a piece.
    expect(listenerStore.size).toBe(exported)
  })

  it('binds every listener to an emitter and event', () => {
    for (const listener of listenerStore.values()) {
      expect(listener.enabled, `${listener.name} should be enabled`).toBe(true)
      expect(
        listener.event,
        `${listener.name} should have an event`,
      ).toBeTruthy()
      expect(
        listener.emitter,
        `${listener.name} should have resolved an emitter`,
      ).toBeTruthy()
    }
  })

  it('resolves string emitters against the client', () => {
    const restListener = listenerStore.get('restEvents')
    expect(restListener).toBeDefined()
    expect(restListener!.emitter).toBe(fakeRest)
  })

  it('registers every exported scheduled task with a traced run wrapper', async () => {
    const exported = await exportedPieceCount(
      join(dist, 'scheduled-tasks'),
      ScheduledTask,
    )
    expect(exported).toBeGreaterThan(0)
    expect(taskStore.size).toBe(exported)

    for (const task of taskStore.values()) {
      // TracedScheduledTask installs the wrapper as an own property; a
      // prototype-only `run` means the tracing wrapper didn't engage.
      expect(
        Object.hasOwn(task, 'run'),
        `${task.name} should have a traced run wrapper`,
      ).toBe(true)
      expect(task.interval, `${task.name} should have an interval`).toBeTruthy()
    }
  })

  it('registers every exported command with traced handler wrappers', async () => {
    const exported = await exportedPieceCount(join(dist, 'commands'), Command)
    expect(exported).toBeGreaterThan(0)
    expect(commandStore.size).toBe(exported)

    for (const command of commandStore.values()) {
      if (typeof command.chatInputRun === 'function') {
        expect(
          Object.hasOwn(command, 'chatInputRun'),
          `${command.name} chatInputRun should be traced`,
        ).toBe(true)
      }
      if (typeof command.contextMenuRun === 'function') {
        expect(
          Object.hasOwn(command, 'contextMenuRun'),
          `${command.name} contextMenuRun should be traced`,
        ).toBe(true)
      }
    }
  })
})

// Deterministic fixtures: the wrapper behavior is tested through our own
// base classes with controlled outcomes, not through real command bodies
// whose failures would depend on library state.
class FixtureCommand extends TracedCommand {
  public behavior: 'succeed' | 'fail' = 'succeed'

  public async chatInputRun(): Promise<string> {
    if (this.behavior === 'fail') {
      throw new Error('fixture failure')
    }
    return 'fixture result'
  }
}

class FixtureTask extends TracedScheduledTask {
  public behavior: 'succeed' | 'fail' = 'succeed'

  public async run(): Promise<string> {
    if (this.behavior === 'fail') {
      throw new Error('fixture failure')
    }
    return 'fixture result'
  }
}

function fakeChatInputInteraction() {
  return {
    id: '1234567890',
    type: 2,
    commandName: 'fixture',
    user: { id: 'u-1', tag: 'tester#0' },
    channelId: 'c-1',
    guild: null,
    guildId: null,
    inGuild: () => false,
    createdTimestamp: Date.now(),
  }
}

describe('traced command wrapper', () => {
  const fixture = new FixtureCommand(
    {
      name: 'fixture',
      path: fileURLToPath(import.meta.url),
      root: dirname(fileURLToPath(import.meta.url)),
      store: commandStore,
    } as never,
    {},
  )

  it('passes the subclass result through and records a span', async () => {
    spanCapture.reset()
    fixture.behavior = 'succeed'

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: intentionally minimal fake
      (fixture.chatInputRun as any)(fakeChatInputInteraction(), {}),
    ).resolves.toBe('fixture result')

    const span = spanCapture
      .spans()
      .find((candidate) => candidate.name === 'discord.command.fixture')
    expect(span, 'command span should be recorded').toBeDefined()
    expect(span!.status.code).not.toBe(SpanStatusCode.ERROR)
    expect(span!.attributes).toMatchObject({
      'discord.command.name': 'fixture',
      'discord.command.type': 'chat_input',
      'sentry.op': 'discord.command',
      scope: 'dm',
    })
  })

  it('records an error span and rethrows failures', async () => {
    spanCapture.reset()
    fixture.behavior = 'fail'

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: intentionally minimal fake
      (fixture.chatInputRun as any)(fakeChatInputInteraction(), {}),
    ).rejects.toThrow('fixture failure')

    const span = spanCapture
      .spans()
      .find((candidate) => candidate.name === 'discord.command.fixture')
    expect(span, 'command span should be recorded').toBeDefined()
    expect(span!.status.code).toBe(SpanStatusCode.ERROR)
    expect(span!.events.some((event) => event.name === 'exception')).toBe(true)
  })
})

describe('traced task wrapper', () => {
  const fixture = new FixtureTask(
    {
      name: 'fixtureTask',
      path: fileURLToPath(import.meta.url),
      root: dirname(fileURLToPath(import.meta.url)),
      store: taskStore,
    } as never,
    { interval: 60_000 },
  )

  it('passes the subclass result through and records a span', async () => {
    spanCapture.reset()
    fixture.behavior = 'succeed'

    await expect(fixture.run()).resolves.toBe('fixture result')

    const span = spanCapture
      .spans()
      .find((candidate) => candidate.name === 'discord.task.fixtureTask')
    expect(span, 'task span should be recorded').toBeDefined()
    expect(span!.status.code).not.toBe(SpanStatusCode.ERROR)
    expect(span!.attributes).toMatchObject({
      'discord.task.name': 'fixtureTask',
      'sentry.op': 'discord.task',
    })
  })

  it('records an error span and rethrows failures', async () => {
    spanCapture.reset()
    fixture.behavior = 'fail'

    await expect(fixture.run()).rejects.toThrow('fixture failure')

    const span = spanCapture
      .spans()
      .find((candidate) => candidate.name === 'discord.task.fixtureTask')
    expect(span, 'task span should be recorded').toBeDefined()
    expect(span!.status.code).toBe(SpanStatusCode.ERROR)
  })
})
