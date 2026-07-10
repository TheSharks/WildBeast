import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import type { ClientEvents, Entitlement } from 'discord.js'
import { Events } from 'discord.js'
import { entitlementRow, upsertEntitlement } from '../../premium/sync.mjs'

/**
 * Mirror entitlement lifecycle events into the database so premium checks
 * outside interactions (scheduled tasks, background jobs) see current data.
 * Interaction-time checks never read this mirror — Discord attaches fresh
 * entitlements to every interaction. A failed write only degrades those
 * background checks until the next event or boot reconcile, so failures log
 * instead of throwing.
 */
async function mirror(
  listener: Listener,
  entitlement: Entitlement,
  overrides: Partial<ReturnType<typeof entitlementRow>> = {},
) {
  try {
    await upsertEntitlement({ ...entitlementRow(entitlement), ...overrides })
  } catch (error) {
    listener.container.logger.warn(
      `Could not mirror entitlement ${entitlement.id}`,
      error,
    )
  }
}

// Pieces default their name to the file name; multiple listeners in one file
// need explicit names or each insert unloads the previous one.
@ApplyOptions<ListenerOptions>({
  name: 'entitlementCreateSync',
  event: Events.EntitlementCreate,
})
export class EntitlementCreateListener extends Listener {
  public run(...[entitlement]: ClientEvents['entitlementCreate']) {
    return mirror(this, entitlement)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'entitlementUpdateSync',
  event: Events.EntitlementUpdate,
})
export class EntitlementUpdateListener extends Listener {
  public run(...[, entitlement]: ClientEvents['entitlementUpdate']) {
    return mirror(this, entitlement)
  }
}

// Discord emits delete for refunds and test-entitlement cleanup. Force the
// deleted flag rather than trusting the payload to carry it.
@ApplyOptions<ListenerOptions>({
  name: 'entitlementDeleteSync',
  event: Events.EntitlementDelete,
})
export class EntitlementDeleteListener extends Listener {
  public run(...[entitlement]: ClientEvents['entitlementDelete']) {
    return mirror(this, entitlement, { deleted: true })
  }
}
