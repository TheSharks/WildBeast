export type Tier = 'free' | 'premium'
export type Scope = 'user' | 'guild'

export interface Grant {
  id: bigint
  skuId: bigint
  owner: { scope: Scope; id: bigint }
  type: number
  deleted: boolean
  startsAt: Date | null
  endsAt: Date | null
}

export interface MirrorState {
  revision: bigint
  completedAt: Date | null
}

export interface MirrorView {
  grants: readonly Grant[]
  state: MirrorState
}

export interface EntitlementRepository {
  state(): Promise<MirrorState>
  /** Rows and state must come from one database snapshot. */
  forOwner(scope: Scope, id: bigint): Promise<MirrorView>
  write(grant: Grant): Promise<void>
  /** Atomic: no writes and no freshness advancement if revision differs. */
  replace(expectedRevision: bigint, grants: readonly Grant[]): Promise<boolean>
}

export interface EntitlementSource {
  /** Return only after every page has been fetched and validated. */
  fetchAll(signal: AbortSignal): Promise<readonly Grant[]>
}

export function active(grant: Grant, now: number): boolean {
  return (
    !grant.deleted &&
    (grant.startsAt === null || grant.startsAt.getTime() <= now) &&
    (grant.endsAt === null || grant.endsAt.getTime() > now)
  )
}

export function tierFor(
  grants: readonly Grant[],
  scope: Scope,
  id: bigint,
  skus: ReadonlyMap<bigint, Tier>,
  now: number,
): Tier {
  return grants.some(
    (grant) =>
      grant.owner.scope === scope &&
      grant.owner.id === id &&
      active(grant, now) &&
      skus.get(grant.skuId) === 'premium',
  )
    ? 'premium'
    : 'free'
}

export interface RawEntitlement {
  id: string
  skuId: string
  userId: string | null
  guildId: string | null
  type: number
  deleted: boolean
  startsAt: Date | null
  endsAt: Date | null
}

/** Discord guild subscriptions can include the purchasing user; guild owns them. */
export function normalizeGrant(raw: RawEntitlement): Grant {
  const scope = raw.guildId !== null ? 'guild' : 'user'
  const ownerId = raw.guildId ?? raw.userId
  if (ownerId === null) throw new Error(`Entitlement ${raw.id} has no owner`)
  for (const date of [raw.startsAt, raw.endsAt]) {
    if (date !== null && !Number.isFinite(date.getTime())) {
      throw new Error(`Entitlement ${raw.id} has an invalid validity timestamp`)
    }
  }
  return {
    id: BigInt(raw.id),
    skuId: BigInt(raw.skuId),
    owner: { scope, id: BigInt(ownerId) },
    type: raw.type,
    deleted: raw.deleted,
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
  }
}
