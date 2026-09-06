import type { BaseInteraction, Entitlement } from 'discord.js'
import { type Grant, normalizeGrant, type Scope, type Tier } from './model.mjs'
import type { PremiumService } from './service.mjs'

/** The interaction-time subject every gate and limit decision starts from. */
export interface PremiumSubject {
  userId: bigint
  guildId: bigint | null
  shardId?: number
  /** Discord attaches every applicable entitlement; authoritative for this interaction. */
  grants: readonly Grant[]
}

export function grantFromEntitlement(entitlement: Entitlement): Grant {
  return normalizeGrant({
    id: entitlement.id,
    skuId: entitlement.skuId,
    userId: entitlement.userId ?? null,
    guildId: entitlement.guildId ?? null,
    type: entitlement.type,
    deleted: entitlement.deleted,
    startsAt: entitlement.startsAt,
    endsAt: entitlement.endsAt,
  })
}

export function subjectFromInteraction(
  interaction: BaseInteraction,
): PremiumSubject {
  const grants: Grant[] = []
  for (const entitlement of interaction.entitlements?.values() ?? []) {
    grants.push(grantFromEntitlement(entitlement))
  }
  const shardId = interaction.guild?.shardId
  return {
    userId: BigInt(interaction.user.id),
    guildId: interaction.guildId ? BigInt(interaction.guildId) : null,
    ...(shardId !== undefined ? { shardId } : {}),
    grants,
  }
}

/** Scope-resolved tier. `any` is for targeting and display, never for limits. */
export function tierForSubject(
  premium: PremiumService,
  subject: PremiumSubject,
  scope: Scope | 'any',
): Tier {
  const user = () =>
    premium.forInteraction(subject.grants, 'user', subject.userId)
  const guild = () =>
    subject.guildId === null
      ? 'free'
      : premium.forInteraction(subject.grants, 'guild', subject.guildId)
  if (scope === 'user') return user()
  if (scope === 'guild') return guild()
  return user() === 'premium' || guild() === 'premium' ? 'premium' : 'free'
}
