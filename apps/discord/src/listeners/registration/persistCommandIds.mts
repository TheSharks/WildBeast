import { ApplyOptions } from '@sapphire/decorators'
import type {
  ApplicationCommandRegistry,
  ListenerOptions,
} from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { persistCommandIds } from '../../utils/idHints.mjs'

/**
 * After Sapphire finishes syncing application commands, store the ids
 * Discord assigned so the next boot can hand them back as idHints.
 */
@ApplyOptions<ListenerOptions>({
  event: Events.ApplicationCommandRegistriesRegistered,
})
export class PersistCommandIdsListener extends Listener {
  public async run(registries: Map<string, ApplicationCommandRegistry>) {
    try {
      await persistCommandIds(registries)
    } catch (error) {
      // Persistence is an optimization for the next boot; this one is
      // already registered and functional.
      this.container.logger.warn('Could not persist command id hints', error)
    }
  }
}
