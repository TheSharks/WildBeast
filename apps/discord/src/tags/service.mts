import type { Grant } from '../premium/model.mjs'
import { commandName, type TagRepository } from './model.mjs'

export interface TagActor {
  guildId: bigint
  userId: bigint
  canManageGuild: boolean
  grants: readonly Grant[]
}

export interface TagLimits {
  forActor(actor: TagActor, kind: 'tags' | 'promotions'): Promise<number>
}

function validCap(cap: number): number {
  if (cap !== Infinity && (!Number.isInteger(cap) || cap < 0))
    throw new Error('Invalid tag limit')
  return cap
}

/** Guild scope and authorization are enforced here, regardless of the caller. */
export class TagService {
  public constructor(
    private readonly repository: TagRepository,
    private readonly limits: TagLimits,
    private readonly reserved: () => ReadonlySet<string>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public find(guildId: bigint, name: string) {
    return this.repository.find(guildId, name.trim())
  }
  public resolve(guildId: bigint, commandId: bigint) {
    return this.repository.byCommand(guildId, commandId)
  }
  public list(guildId: bigint, authorId?: bigint) {
    return this.repository.list(guildId, authorId)
  }
  public search(guildId: bigint, query: string, promotedOnly = false) {
    return this.repository.search(guildId, query, promotedOnly)
  }
  public suggest(guildId: bigint, query: string) {
    return this.repository.suggest(guildId, query)
  }
  /** Durable promotion state, for surfacing repair outcomes to the requester. */
  public intentsFor(guildId: bigint) {
    return this.repository.withGuild(guildId, (tags) => tags.intents())
  }

  public async create(actor: TagActor, rawName: string, content: string) {
    const name = rawName.trim()
    if (!name || name.length > 32) return { kind: 'invalidName' as const }
    const limit = validCap(await this.limits.forActor(actor, 'tags'))
    return this.repository.withGuild(actor.guildId, async (tags) => {
      if ((await tags.count()) >= limit)
        return { kind: 'limit' as const, limit }
      const tag = await tags.create({ name, content, authorId: actor.userId })
      return tag
        ? { kind: 'created' as const, tag }
        : { kind: 'exists' as const }
    })
  }

  public async edit(actor: TagActor, name: string, content: string) {
    return this.repository.withGuild(actor.guildId, async (tags) => {
      const tag = await tags.find(name.trim())
      if (!tag) return { kind: 'notFound' as const }
      if (tag.authorId !== actor.userId && !actor.canManageGuild)
        return { kind: 'forbidden' as const }
      await tags.edit(tag.id, content)
      return { kind: 'updated' as const, tag: { ...tag, content } }
    })
  }

  public async remove(actor: TagActor, name: string) {
    return this.repository.withGuild(actor.guildId, async (tags) => {
      const tag = await tags.find(name.trim())
      if (!tag) return { kind: 'notFound' as const }
      if (tag.authorId !== actor.userId && !actor.canManageGuild)
        return { kind: 'forbidden' as const }
      await tags.remove(tag.id)
      return { kind: 'deleted' as const, tag }
    })
  }

  public async promote(
    actor: TagActor,
    name: string,
    description: string,
    argsDescription: string,
  ) {
    if (!actor.canManageGuild) return { kind: 'forbidden' as const }
    const limit = validCap(await this.limits.forActor(actor, 'promotions'))
    return this.repository.withGuild(actor.guildId, async (tags) => {
      const tag = await tags.find(name.trim())
      if (!tag) return { kind: 'notFound' as const }
      const normalized = commandName(tag.name, this.reserved())
      if (!normalized.ok) return { kind: normalized.reason }
      const intents = await tags.intents()
      const cleanup = intents.find(
        (intent) =>
          intent.name === normalized.name &&
          (!intent.wanted || intent.tagId === null) &&
          intent.attempted &&
          intent.commandId === null,
      )
      if (cleanup) return { kind: 'cleanupPending' as const, tag }
      const held = intents.find(
        (intent) => intent.tagId === tag.id && intent.wanted,
      )
      if (held)
        return {
          kind:
            held.commandId === null
              ? ('requested' as const)
              : ('alreadyPromoted' as const),
          tag,
        }
      if (
        intents.filter((intent) => intent.wanted && intent.tagId !== null)
          .length >= limit
      ) {
        return { kind: 'limit' as const, limit }
      }
      if (!description.trim() || !argsDescription.trim())
        throw new Error('Command descriptions cannot be empty')
      await tags.request({
        tagId: tag.id,
        name: normalized.name,
        description: description.slice(0, 100),
        argsDescription: argsDescription.slice(0, 100),
        requestedBy: actor.userId,
        requestedAt: this.now(),
      })
      return { kind: 'requested' as const, tag }
    })
  }

  public async demote(actor: TagActor, name: string) {
    if (!actor.canManageGuild) return { kind: 'forbidden' as const }
    return this.repository.withGuild(actor.guildId, async (tags) => {
      const tag = await tags.find(name.trim())
      if (!tag) return { kind: 'notFound' as const }
      const intent = (await tags.intents()).find(
        (candidate) => candidate.tagId === tag.id,
      )
      if (!intent) return { kind: 'notPromoted' as const, tag }
      await tags.withdraw(intent.id)
      return { kind: 'requested' as const, tag }
    })
  }
}
