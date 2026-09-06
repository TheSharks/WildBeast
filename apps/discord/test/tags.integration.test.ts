import {
  createDatabase,
  eq,
  sql,
  tagCommandIntents,
  tags,
} from '@thesharks/drizzle'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { PostgresTags } from '../src/adapters/tags-postgres.mjs'
import type {
  CommandIntent,
  RemoteTagCommand,
  TagCommandGateway,
  TagRepository,
} from '../src/tags/model.mjs'
import { TagReconciler } from '../src/tags/reconciler.mjs'
import { type TagActor, TagService } from '../src/tags/service.mjs'

const url = process.env.DATABASE_URL
const actor: TagActor = {
  guildId: 90001n,
  userId: 90002n,
  canManageGuild: true,
  grants: [],
}
const signal = () => new AbortController().signal

class Gateway implements TagCommandGateway {
  public commands = new Map<bigint, RemoteTagCommand>()
  public creates = 0
  public deleted: bigint[] = []
  public failAfterCreate = false
  public failDelete = false
  public async list() {
    return [...this.commands.values()]
  }
  public async create(_guild: bigint, intent: CommandIntent) {
    const id = BigInt(1000 + ++this.creates)
    this.commands.set(id, {
      id,
      name: intent.name,
      description: intent.description,
      argsDescription: intent.argsDescription,
      tagShape: true,
    })
    if (this.failAfterCreate) {
      this.failAfterCreate = false
      throw new Error('Response lost')
    }
    return id
  }
  public async update(_guild: bigint, id: bigint, intent: CommandIntent) {
    this.commands.set(id, {
      id,
      name: intent.name,
      description: intent.description,
      argsDescription: intent.argsDescription,
      tagShape: true,
    })
  }
  public async delete(_guild: bigint, id: bigint) {
    if (this.failDelete) throw new Error('Delete failed')
    this.deleted.push(id)
    this.commands.delete(id)
  }
}

describe.skipIf(!url)('replacement tag workflows (PostgreSQL)', () => {
  let connection: ReturnType<typeof createDatabase>
  let repository: PostgresTags
  let service: TagService
  let gateway: Gateway
  let reconciler: TagReconciler
  let tagCap = 50
  let promotionCap = 25
  let mayRevoke = true
  let validUntil = Infinity

  beforeAll(() => {
    connection = createDatabase(url!)
    repository = new PostgresTags(connection)
  })
  beforeEach(async () => {
    await connection.db.delete(tagCommandIntents)
    await connection.db.delete(tags)
    tagCap = 50
    promotionCap = 25
    mayRevoke = true
    validUntil = Infinity
    service = new TagService(
      repository,
      {
        forActor: async (_actor, kind) =>
          kind === 'tags' ? tagCap : promotionCap,
      },
      () => new Set(['tag', 'ping']),
    )
    gateway = new Gateway()
    reconciler = new TagReconciler(
      repository,
      gateway,
      async () => ({ cap: promotionCap, mayRevoke, validUntil }),
      () => new Set(['tag', 'ping']),
    )
  })
  afterAll(async () => {
    await connection?.close()
  })

  async function promoted(name = 'hello') {
    expect((await service.create(actor, name, 'world')).kind).toBe('created')
    expect(
      (await service.promote(actor, name, 'Description', 'Arguments')).kind,
    ).toBe('requested')
    const result = await reconciler.reconcileGuild(actor.guildId, signal())
    expect(result.failures).toEqual([])
    return (await service.find(actor.guildId, name))!
  }

  it('enforces the create cap across concurrent requests', async () => {
    tagCap = 3
    const outcomes = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        service.create(actor, `tag${i}`, 'body'),
      ),
    )
    expect(
      outcomes.filter((outcome) => outcome.kind === 'created'),
    ).toHaveLength(3)
    expect(outcomes.filter((outcome) => outcome.kind === 'limit')).toHaveLength(
      17,
    )
    expect(await service.list(actor.guildId)).toHaveLength(3)
  })

  it('preserves case-insensitive names and guild isolation', async () => {
    await service.create(actor, ' Hello ', 'body')
    expect((await service.create(actor, 'HELLO', 'duplicate')).kind).toBe(
      'exists',
    )
    expect((await service.find(actor.guildId, 'hello'))?.name).toBe('Hello')
    expect(await service.find(90003n, 'hello')).toBeUndefined()
    expect(
      (await service.create({ ...actor, guildId: 90003n }, 'hello', 'other'))
        .kind,
    ).toBe('created')
    expect(await service.list(actor.guildId)).toHaveLength(1)
  })

  it('enforces authorship and manager permissions inside the service', async () => {
    await service.create(actor, 'hello', 'body')
    const stranger = { ...actor, userId: 90004n, canManageGuild: false }
    expect((await service.edit(stranger, 'hello', 'bad')).kind).toBe(
      'forbidden',
    )
    expect((await service.remove(stranger, 'hello')).kind).toBe('forbidden')
    expect(
      (await service.promote(stranger, 'hello', 'description', 'args')).kind,
    ).toBe('forbidden')
    expect((await service.demote(stranger, 'hello')).kind).toBe('forbidden')
    expect(
      (
        await service.edit(
          { ...actor, canManageGuild: false },
          'hello',
          'author edit',
        )
      ).kind,
    ).toBe('updated')
    expect(
      (await service.remove({ ...stranger, canManageGuild: true }, 'hello'))
        .kind,
    ).toBe('deleted')
  })

  it('counts pending promotions against the cap before any REST request', async () => {
    promotionCap = 2
    for (const name of ['one', 'two', 'three'])
      await service.create(actor, name, 'body')
    const outcomes = await Promise.all(
      ['one', 'two', 'three'].map((name) =>
        service.promote(actor, name, 'Description', 'Arguments'),
      ),
    )
    expect(
      outcomes.filter((outcome) => outcome.kind === 'requested'),
    ).toHaveLength(2)
    expect(outcomes.filter((outcome) => outcome.kind === 'limit')).toHaveLength(
      1,
    )
    expect(gateway.creates).toBe(0)
  })

  it('rejects invalid and reserved promotion names without recording intent', async () => {
    await service.create(actor, 'Ping', 'body')
    await service.create(actor, 'two words', 'body')
    expect(
      (await service.promote(actor, 'Ping', 'Description', 'Arguments')).kind,
    ).toBe('reserved')
    expect(
      (await service.promote(actor, 'two words', 'Description', 'Arguments'))
        .kind,
    ).toBe('invalidName')
    expect(await repository.guildsWithIntents()).toEqual([])
  })

  it('recovers a successful create whose response was lost without creating again', async () => {
    await service.create(actor, 'hello', 'body')
    await service.promote(actor, 'hello', 'Description', 'Arguments')
    gateway.failAfterCreate = true
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).failures,
    ).toHaveLength(1)
    expect((await service.find(actor.guildId, 'hello'))?.commandId).toBeNull()
    const intents = await repository.withGuild(actor.guildId, (repo) =>
      repo.intents(),
    )
    expect(intents[0]).toMatchObject({
      wanted: true,
      attempted: true,
      commandId: null,
    })
    const retried = await reconciler.reconcileGuild(actor.guildId, signal())
    expect(retried).toMatchObject({ recovered: 1, created: 0, failures: [] })
    expect(gateway.creates).toBe(1)
    expect((await service.find(actor.guildId, 'hello'))?.commandId).toBe(1001n)
  })

  it('recovers the Discord-to-database commit failure window', async () => {
    await service.create(actor, 'hello', 'body')
    await service.promote(actor, 'hello', 'Description', 'Arguments')
    let failBind = true
    const unreliable = Object.create(repository) as TagRepository
    unreliable.withGuild = (guildId, work) =>
      repository.withGuild(guildId, async (repo) => {
        const wrapped = Object.create(repo) as typeof repo
        wrapped.bind = async (intent, id) => {
          if (failBind) {
            failBind = false
            throw new Error('Commit failed')
          }
          return repo.bind(intent, id)
        }
        return work(wrapped)
      })
    const repair = new TagReconciler(
      unreliable,
      gateway,
      async () => ({ cap: 25, mayRevoke: true, validUntil: Infinity }),
      () => new Set(),
    )
    expect(
      (await repair.reconcileGuild(actor.guildId, signal())).failures,
    ).toHaveLength(1)
    expect(
      (await repair.reconcileGuild(actor.guildId, signal())).recovered,
    ).toBe(1)
    expect(gateway.creates).toBe(1)
  })

  it('retains cleanup after deleting a tag and retries failed Discord deletion', async () => {
    const tag = await promoted()
    await service.remove(actor, 'hello')
    gateway.failDelete = true
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).failures,
    ).toHaveLength(1)
    const intents = await repository.withGuild(actor.guildId, (repo) =>
      repo.intents(),
    )
    expect(intents[0]).toMatchObject({
      tagId: null,
      wanted: false,
      commandId: tag.commandId,
    })
    gateway.failDelete = false
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).removed,
    ).toBe(1)
    expect(await repository.guildsWithIntents()).toEqual([])
  })

  it('resolves promoted commands only in their owning guild', async () => {
    const tag = await promoted()
    expect(await service.resolve(actor.guildId, tag.commandId!)).toMatchObject({
      id: tag.id,
    })
    expect(await service.resolve(90003n, tag.commandId!)).toBeUndefined()
  })

  it('keeps older promotions and defers over-cap revocation until freshness is proven', async () => {
    await promoted('first')
    await promoted('second')
    promotionCap = 1
    mayRevoke = false
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).deferred,
    ).toBe(true)
    expect(gateway.deleted).toEqual([])
    mayRevoke = true
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).removed,
    ).toBe(1)
    expect(
      (await service.find(actor.guildId, 'first'))?.commandId,
    ).not.toBeNull()
    expect((await service.find(actor.guildId, 'second'))?.commandId).toBeNull()
  })

  it('rechecks the freshness deadline after acquiring a guild lock', async () => {
    await promoted()
    promotionCap = 0
    validUntil = Date.now() - 1
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).deferred,
    ).toBe(true)
    expect(gateway.deleted).toEqual([])
  })

  it('does not adopt or remove unrelated commands just because they have a tag shape', async () => {
    gateway.commands.set(999n, {
      id: 999n,
      name: 'hello',
      description: 'Description',
      argsDescription: 'Arguments',
      tagShape: true,
    })
    await service.create(actor, 'hello', 'body')
    await service.promote(actor, 'hello', 'Description', 'Arguments')
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).failures,
    ).toHaveLength(1)
    expect(gateway.creates).toBe(0)
    expect(gateway.deleted).toEqual([])
    expect((await service.find(actor.guildId, 'hello'))?.commandId).toBeNull()
  })

  it('keeps the cleanup intent of a promoted command when the tag row is deleted directly', async () => {
    const tag = await promoted()
    await connection.db.delete(tags).where(eq(tags.id, tag.id))
    expect(
      (await repository.withGuild(actor.guildId, (repo) => repo.intents()))[0],
    ).toMatchObject({ tagId: null, commandId: tag.commandId })
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).removed,
    ).toBe(1)
    expect(gateway.commands.size).toBe(0)
  })

  it('does not hold a transaction open while a REST request runs', async () => {
    await service.create(actor, 'hello', 'body')
    await service.promote(actor, 'hello', 'Description', 'Arguments')
    const originalCreate = gateway.create.bind(gateway)
    gateway.create = async (guildId, intent) => {
      // Another connection sees the committed attempt before Discord returns.
      const [stored] = await connection.db
        .select()
        .from(tagCommandIntents)
        .where(eq(tagCommandIntents.id, intent.id))
      expect(stored?.attempted).toBe(true)
      return originalCreate(guildId, intent)
    }
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).failures,
    ).toEqual([])
  })

  it('serializes user deletion behind an in-flight promotion repair', async () => {
    await service.create(actor, 'hello', 'body')
    await service.promote(actor, 'hello', 'Description', 'Arguments')
    let enter!: () => void
    let release!: () => void
    const entered = new Promise<void>((done) => {
      enter = done
    })
    const gate = new Promise<void>((done) => {
      release = done
    })
    const originalCreate = gateway.create.bind(gateway)
    gateway.create = async (guildId, intent) => {
      enter()
      await gate
      return originalCreate(guildId, intent)
    }
    const repair = reconciler.reconcileGuild(actor.guildId, signal())
    await entered
    const deletion = service.remove(actor, 'hello')
    try {
      await vi.waitFor(async () => {
        const waiting = await connection.db.execute(
          sql`SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`,
        )
        expect(waiting.rows[0]?.n).toBeGreaterThan(0)
      })
    } finally {
      release()
      await repair
      await deletion
    }
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).removed,
    ).toBe(1)
    expect(gateway.commands.size).toBe(0)
  })

  it('continues non-destructive repairs when premium lookup is unavailable', async () => {
    await service.create(actor, 'hello', 'body')
    await service.promote(actor, 'hello', 'Description', 'Arguments')
    const repair = new TagReconciler(
      repository,
      gateway,
      async () => {
        throw new Error('Mirror unavailable')
      },
      () => new Set(),
    )
    expect(await repair.reconcileGuild(actor.guildId, signal())).toMatchObject({
      created: 1,
      deferred: true,
      failures: [],
    })
    expect(
      (await service.find(actor.guildId, 'hello'))?.commandId,
    ).not.toBeNull()
  })

  it('cancels an unattempted promotion without touching a conflicting command', async () => {
    await service.create(actor, 'hello', 'body')
    await service.promote(actor, 'hello', 'Description', 'Arguments')
    await service.demote(actor, 'hello')
    gateway.commands.set(999n, {
      id: 999n,
      name: 'hello',
      description: 'Unowned',
      argsDescription: 'Arguments',
      tagShape: true,
    })
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).removed,
    ).toBe(1)
    expect(gateway.commands.has(999n)).toBe(true)
    expect(await repository.guildsWithIntents()).toEqual([])
  })

  it('finishes ambiguous create cleanup before accepting a different payload', async () => {
    await service.create(actor, 'hello', 'body')
    await service.promote(actor, 'hello', 'Description', 'Arguments')
    gateway.failAfterCreate = true
    await reconciler.reconcileGuild(actor.guildId, signal())
    await service.demote(actor, 'hello')
    expect(
      (await service.promote(actor, 'hello', 'Different', 'Arguments')).kind,
    ).toBe('cleanupPending')
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).removed,
    ).toBe(1)
    expect(
      (await service.promote(actor, 'hello', 'Different', 'Arguments')).kind,
    ).toBe('requested')
    expect(
      (await reconciler.reconcileGuild(actor.guildId, signal())).created,
    ).toBe(1)
    expect([...gateway.commands.values()][0]?.description).toBe('Different')
  })

  it('keeps autocomplete and suggestions guild scoped', async () => {
    await service.create(actor, 'greeting', 'body')
    await service.create({ ...actor, guildId: 90003n }, 'greeter', 'other')
    expect(await service.search(actor.guildId, 'gree')).toEqual(['greeting'])
    expect(await service.suggest(actor.guildId, 'greetin')).toBe('greeting')
    expect(await service.search(actor.guildId, 'gree', true)).toEqual([])
  })
})
