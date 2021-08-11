import { ShardClient } from 'detritus-client'
import { Interaction } from 'detritus-client/lib/structures'
import { APIButtonComponentWithCustomId, ComponentType } from 'discord-api-types'
import { RequestTypes } from 'detritus-client-rest'
import { ComponentBase } from './ComponentBase'

interface IButtonComponent {
  // discord-api-types declares emoji.name as optional but its not >:(
  data: Omit<APIButtonComponentWithCustomId, 'custom_id' | 'emoji' | 'type'> & Pick<RequestTypes.CreateChannelMessageComponent, 'emoji'>
  id: string
  fn: (this: ShardClient, interaction: Interaction) => Promise<void> | void
}

export interface ButtonComponent extends IButtonComponent { }

export class ButtonComponent extends ComponentBase {
  constructor (data: IButtonComponent) {
    super(data)
    Object.assign(this, data)
  }

  toJSON (): RequestTypes.CreateChannelMessageComponent {
    return { ...this.data, type: ComponentType.Button, customId: this.id }
  }
}
