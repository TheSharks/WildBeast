import { ApplyOptions } from '@sapphire/decorators'
import type {
  ApplicationCommandRegistry,
  ListenerOptions,
} from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'

/** Store the ids Discord assigned so the next boot hands them back as hints. */
@ApplyOptions<ListenerOptions>({
  event: Events.ApplicationCommandRegistriesRegistered,
})
export class PersistCommandIdsListener extends Listener {
  public async run(registries: Map<string, ApplicationCommandRegistry>) {
    const app = this.container.app
    try {
      // Operator commands own their placements; Sapphire's empty registry
      // for them must not erase those rows.
      const owned = app.operatorCommands.names()
      await app.work.run(() =>
        app.commandIds.persist(
          new Map([...registries].filter(([name]) => !owned.has(name))),
        ),
      )
    } catch (error) {
      // This boot is already registered; persistence only helps the next one.
      this.container.logger.warn('Could not persist command id hints', error)
    }
  }
}
