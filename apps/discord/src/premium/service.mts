import {
  type EntitlementRepository,
  type EntitlementSource,
  type Grant,
  type Scope,
  type Tier,
  tierFor,
} from './model.mjs'

export type Freshness = 'fresh' | 'never-synced' | 'stale' | 'invalid-clock'
export interface PremiumDecision {
  tier: Tier
  freshness: Freshness
  mayRevoke: boolean
  validUntil: number | null
}

export class PremiumService {
  public constructor(
    private readonly repository: EntitlementRepository,
    private readonly skus: ReadonlyMap<bigint, Tier>,
    private readonly now: () => number = Date.now,
    private readonly staleAfterMs = 24 * 60 * 60 * 1000,
  ) {
    if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) {
      throw new Error('Entitlement freshness duration must be positive')
    }
  }

  public forInteraction(
    grants: readonly Grant[],
    scope: Scope,
    id: bigint,
  ): Tier {
    return tierFor(grants, scope, id, this.skus, this.now())
  }

  public async forBackground(
    scope: Scope,
    id: bigint,
  ): Promise<PremiumDecision> {
    const view = await this.repository.forOwner(scope, id)
    const now = this.now()
    const completed = view.state.completedAt?.getTime()
    const freshness: Freshness =
      completed === undefined
        ? 'never-synced'
        : !Number.isFinite(completed) || completed > now
          ? 'invalid-clock'
          : now - completed > this.staleAfterMs
            ? 'stale'
            : 'fresh'
    return {
      tier: tierFor(view.grants, scope, id, this.skus, now),
      freshness,
      // An expired or deleted row is not proof that a different grant is absent.
      mayRevoke: freshness === 'fresh',
      validUntil:
        freshness === 'fresh' && completed !== undefined
          ? completed + this.staleAfterMs
          : null,
    }
  }
}

export type SyncResult =
  | { kind: 'completed'; count: number }
  | { kind: 'superseded' }

/** One in-flight snapshot per worker; DB revision also detects other workers' writes. */
export class EntitlementSynchronizer {
  private pending?: Promise<SyncResult>

  public constructor(
    private readonly repository: EntitlementRepository,
    private readonly source: EntitlementSource,
  ) {}

  public synchronize(signal: AbortSignal): Promise<SyncResult> {
    if (this.pending) return this.pending
    const work = this.run(signal)
    this.pending = work
    void work
      .finally(() => {
        if (this.pending === work) this.pending = undefined
      })
      .catch(() => {
        /* caller owns the error */
      })
    return work
  }

  private async run(signal: AbortSignal): Promise<SyncResult> {
    signal.throwIfAborted()
    const { revision } = await this.repository.state()
    const grants = await this.source.fetchAll(signal)
    signal.throwIfAborted()
    const committed = await this.repository.replace(revision, grants)
    return committed
      ? { kind: 'completed', count: grants.length }
      : { kind: 'superseded' }
  }

  public write(grant: Grant): Promise<void> {
    return this.repository.write(grant)
  }
}
