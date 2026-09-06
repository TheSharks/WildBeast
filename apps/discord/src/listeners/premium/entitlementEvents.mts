import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import type { ClientEvents, Entitlement } from 'discord.js'
import { Events } from 'discord.js'
import { grantFromEntitlement } from '../../premium/interaction.mjs'
import { WorkRejected } from '../../runtime/work.mjs'

/**
 * Mirror lifecycle events so background checks see current data. A failed
 * write degrades background decisions until the next snapshot, so it logs.
 */
async function mirror(
  listener: Listener,
  entitlement: Entitlement,
  overrides: { deleted?: boolean } = {},
) {
  try {
    await listener.container.app.work.run(() =>
      listener.container.app.entitlements.write({
        ...grantFromEntitlement(entitlement),
        ...overrides,
      }),
    )
  } catch (error) {
    if (error instanceof WorkRejected) return
    listener.container.logger.warn(
      `Could not mirror entitlement ${entitlement.id}`,
      error,
    )
  }
}

// Same-file listeners need explicit names or each insert unloads the last.
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

// Delete arrives for refunds and test cleanup; force the flag regardless of payload.
@ApplyOptions<ListenerOptions>({
  name: 'entitlementDeleteSync',
  event: Events.EntitlementDelete,
})
export class EntitlementDeleteListener extends Listener {
  public run(...[entitlement]: ClientEvents['entitlementDelete']) {
    return mirror(this, entitlement, { deleted: true })
  }
}
