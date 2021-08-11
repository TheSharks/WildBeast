import { ShardClient } from 'detritus-client'
import { Interaction, InteractionDataComponent } from 'detritus-client/lib/structures'
import { debug, error, info } from '../internal/logger'

interface IComponentBase {
  id: string
  fn: (this: ShardClient, interaction: Interaction) => Promise<void> | void
}

export interface ComponentBase extends IComponentBase { }

export class ComponentBase {
  constructor (data: IComponentBase) {
    Object.assign(this, data)
  }

  async run (interaction: Interaction, shard: ShardClient): Promise<void> {
    info(`${(interaction.data as InteractionDataComponent).customId} component interaction received`, 'Interactions')
    try {
      await this.fn.apply(shard, [interaction])
    } catch (e) {
      error(e, 'Components')
    } finally {
      debug(`${(interaction.data as InteractionDataComponent).customId} component interaction finished`, 'Interactions')
    }
  }
}
