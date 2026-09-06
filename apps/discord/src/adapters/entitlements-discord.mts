import type { Client } from 'discord.js'
import {
  type EntitlementSource,
  type Grant,
  normalizeGrant,
} from '../premium/model.mjs'

/** Discord's listing can start in the middle; walk both directions from page one. */
export class DiscordEntitlements implements EntitlementSource {
  private readonly client: () => Client<true>

  /** Accepts a getter so the adapter can exist before login completes. */
  public constructor(client: Client<true> | (() => Client<true>)) {
    this.client = typeof client === 'function' ? client : () => client
  }

  public async fetchAll(signal: AbortSignal): Promise<readonly Grant[]> {
    const pageSize = 100
    const fetch = async (cursor?: { before: string } | { after: string }) => {
      signal.throwIfAborted()
      const page = await this.client().application.entitlements.fetch({
        limit: pageSize,
        cache: false,
        excludeDeleted: false,
        excludeEnded: false,
        ...cursor,
      })
      signal.throwIfAborted()
      return page
    }
    const first = await fetch()
    const grants = new Map<bigint, Grant>()
    const add = (page: typeof first) => {
      for (const entitlement of page.values()) {
        const grant = normalizeGrant(entitlement)
        grants.set(grant.id, grant)
      }
    }
    add(first)
    if (first.size < pageSize) return [...grants.values()]
    const bounds = (page: typeof first) => {
      const ids = [...page.keys()].map(BigInt)
      return {
        min: ids.reduce((a, b) => (a < b ? a : b)),
        max: ids.reduce((a, b) => (a > b ? a : b)),
      }
    }
    const initial = bounds(first)
    for (const direction of ['before', 'after'] as const) {
      let boundary = direction === 'before' ? initial.min : initial.max
      for (;;) {
        const cursor =
          direction === 'before'
            ? { before: boundary.toString() }
            : { after: boundary.toString() }
        const page = await fetch(cursor)
        if (page.size === 0) break
        const nextBounds = bounds(page)
        // Every returned ID must respect the cursor, including the final short page.
        if (
          direction === 'before'
            ? nextBounds.max >= boundary
            : nextBounds.min <= boundary
        ) {
          throw new Error(
            `Entitlement pagination violated ${direction} cursor ${boundary}`,
          )
        }
        add(page)
        if (page.size < pageSize) break
        boundary = direction === 'before' ? nextBounds.min : nextBounds.max
      }
    }
    return [...grants.values()]
  }
}
