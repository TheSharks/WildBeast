import {
  commandName,
  matchesIntent,
  type TagCommandGateway,
  type TagRepository,
} from './model.mjs'

export interface BackgroundTagLimit {
  cap: number
  mayRevoke: boolean
  validUntil: number | null
}
export interface RepairResult {
  created: number
  recovered: number
  removed: number
  deferred: boolean
  policyError?: unknown
  failures: Array<{ intentId: number; error: unknown }>
}

export class TagReconciler {
  public constructor(
    private readonly repository: TagRepository,
    private readonly gateway: TagCommandGateway,
    private readonly policy: (guildId: bigint) => Promise<BackgroundTagLimit>,
    private readonly reserved: () => ReadonlySet<string>,
  ) {}

  public async reconcileGuild(
    guildId: bigint,
    signal: AbortSignal,
  ): Promise<RepairResult> {
    // Resolve policy before reserving a connection; concurrent guild workers
    // must not exhaust the pool while each waits for another policy connection.
    let policyError: unknown
    const policy = await this.policy(guildId).catch((error: unknown) => {
      policyError = error
      return { cap: Infinity, mayRevoke: false, validUntil: null }
    })
    return this.repository.withGuild(guildId, async (tags) => {
      signal.throwIfAborted()
      const intents = await tags.intents()
      const cap = policy.cap
      const mayRevoke = () =>
        policy.mayRevoke &&
        policy.validUntil !== null &&
        Date.now() <= policy.validUntil
      if (cap !== Infinity && (!Number.isInteger(cap) || cap < 0))
        throw new Error('Invalid promotion cap')
      const result: RepairResult = {
        created: 0,
        recovered: 0,
        removed: 0,
        deferred: false,
        failures: [],
      }
      const wanted = intents
        .filter((intent) => intent.wanted && intent.tagId !== null)
        .sort(
          (a, b) =>
            a.requestedAt.getTime() - b.requestedAt.getTime() || a.id - b.id,
        )
      const overCap = new Set(wanted.slice(cap))
      result.deferred =
        policyError !== undefined || (!mayRevoke() && overCap.size > 0)
      if (policyError !== undefined) result.policyError = policyError
      const remote = await this.gateway.list(guildId)
      for (const intent of intents) {
        signal.throwIfAborted()
        try {
          const invalidName = !commandName(intent.name, this.reserved()).ok
          if (
            intent.wanted &&
            (intent.tagId === null ||
              invalidName ||
              (mayRevoke() && overCap.has(intent)))
          ) {
            await tags.withdraw(intent.id)
            intent.wanted = false
          }
          if (!mayRevoke() && overCap.has(intent)) result.deferred = true
          if (
            !intent.wanted &&
            !intent.attempted &&
            intent.commandId === null
          ) {
            await tags.forget(intent)
            result.removed++
            continue
          }
          let command = remote.find(
            (candidate) => candidate.id === intent.commandId,
          )
          const named = remote.find(
            (candidate) => candidate.name === intent.name,
          )
          if (!command && named) {
            // Durable evidence that we attempted this exact payload is required
            // for recovery. Merely resembling a tag never grants ownership.
            if (!intent.attempted || !matchesIntent(named, intent)) {
              throw new Error(
                `Command name ${intent.name} is occupied by an unowned command`,
              )
            }
            command = named
            await tags.bind(intent, command.id)
            intent.commandId = command.id
            result.recovered++
          }
          if (!intent.wanted) {
            if (command) await this.gateway.delete(guildId, command.id)
            else if (intent.attempted && intent.commandId === null) {
              // A timed-out create has an unknown outcome. Finish the same
              // idempotent create before deleting, so a retry has a known ID.
              const id = await this.gateway.create(guildId, intent)
              await tags.bind(intent, id)
              await this.gateway.delete(guildId, id)
            }
            await tags.forget(intent)
            result.removed++
            continue
          }
          if (command) {
            if (!matchesIntent(command, intent))
              await this.gateway.update(guildId, command.id, intent)
            // Repairs the compatibility fields too, even if an earlier bind failed.
            await tags.bind(intent, command.id)
            continue
          }
          await tags.markAttempted(intent.id)
          signal.throwIfAborted()
          const id = await this.gateway.create(guildId, intent)
          await tags.bind(intent, id)
          result.created++
        } catch (error) {
          signal.throwIfAborted()
          result.failures.push({ intentId: intent.id, error })
        }
      }
      return result
    })
  }

  public async reconcileAll(signal: AbortSignal, skipGuild?: bigint) {
    const results = new Map<bigint, RepairResult | Error>()
    for (const guildId of await this.repository.guildsWithIntents()) {
      signal.throwIfAborted()
      if (guildId === skipGuild) continue
      try {
        results.set(guildId, await this.reconcileGuild(guildId, signal))
      } catch (error) {
        signal.throwIfAborted()
        results.set(
          guildId,
          error instanceof Error ? error : new Error(String(error)),
        )
      }
    }
    return results
  }
}
