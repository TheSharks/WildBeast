import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'

/**
 * Sapphire's bulk overwrite of the dev guild just ran; place operator
 * commands right away instead of waiting for the hourly task. Shard 0's
 * worker owns app-global placement, like every other fleet-wide job.
 */
@ApplyOptions<ListenerOptions>({
  name: 'operatorCommandsPlacement',
  event: Events.ApplicationCommandRegistriesRegistered,
})
export class OperatorCommandsPlacementListener extends Listener {
  public async run() {
    if (!this.container.client.ws.shards.has(0)) return
    try {
      await this.container.tasks.create('operatorCommandReconcile', {
        repeated: false,
        delay: 0,
        customJobOptions: {
          jobId: `operatorCommandReconcile:boot:${Date.now()}`,
        },
      })
    } catch (error) {
      this.container.logger.warn(
        'Could not enqueue operator command placement; the hourly run covers it',
        error,
      )
    }
  }
}
