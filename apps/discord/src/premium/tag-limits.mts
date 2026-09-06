import type { BackgroundTagLimit } from '../tags/reconciler.mjs'
import type { TagActor, TagLimits } from '../tags/service.mjs'
import { clampLimitOverride, getLimit, type LimitKey } from './limits.mjs'
import type { Tier } from './model.mjs'
import type { PremiumService } from './service.mjs'

export interface TagLimitFlags {
  evaluate(
    key: LimitKey,
    fallback: number,
    context: { guildId: bigint; userId?: bigint; tier: Tier },
  ): Promise<unknown>
}

/** The registry is shared data; flag I/O and entitlement policy are injected. */
export class PremiumTagLimits implements TagLimits {
  public constructor(
    private readonly premium: PremiumService,
    private readonly flags?: TagLimitFlags,
    private readonly onInvalidOverride?: (
      key: LimitKey,
      raw: unknown,
      fallback: number,
    ) => void,
  ) {}

  public async forActor(actor: TagActor, kind: 'tags' | 'promotions') {
    const tier = this.premium.forInteraction(
      actor.grants,
      'guild',
      actor.guildId,
    )
    const key =
      kind === 'tags' ? 'tags.maxPerGuild' : 'tags.maxPromotedPerGuild'
    const fallback = getLimit(key, tier)
    const raw = await this.flags?.evaluate(key, fallback, {
      guildId: actor.guildId,
      userId: actor.userId,
      tier,
    })
    return this.clamp(key, raw, fallback)
  }

  public async forBackground(guildId: bigint): Promise<BackgroundTagLimit> {
    const decision = await this.premium.forBackground('guild', guildId)
    const fallback = getLimit('tags.maxPromotedPerGuild', decision.tier)
    const raw = await this.flags?.evaluate(
      'tags.maxPromotedPerGuild',
      fallback,
      { guildId, tier: decision.tier },
    )
    return {
      cap: this.clamp('tags.maxPromotedPerGuild', raw, fallback),
      mayRevoke: decision.mayRevoke,
      validUntil: decision.validUntil,
    }
  }

  private clamp(key: LimitKey, raw: unknown, fallback: number): number {
    if (raw === undefined) return fallback
    const clamped = clampLimitOverride(raw, fallback)
    if (clamped !== raw) this.onInvalidOverride?.(key, raw, fallback)
    return clamped
  }
}
