import { ShardClient } from 'detritus-client'
import { RequestTypes } from 'detritus-client-rest'
import { Interaction } from 'detritus-client/lib/structures'
import { ComponentType } from 'discord-api-types'

export interface ISelectMenu {
  id: string
  data: RequestTypes.CreateChannelMessageComponentSelectMenuOption[]
  placeholder?: string
  max?: number
  min?: number
  fn: (this: ShardClient, interaction: Interaction) => Promise<void> | void
}

export interface SelectMenuComponent extends ISelectMenu { }

export class SelectMenuComponent {
  constructor (data: ISelectMenu) {
    Object.assign(this, data)
  }

  toJSON (): RequestTypes.CreateChannelMessageComponent {
    return { type: ComponentType.SelectMenu, options: this.data, customId: this.id, placeholder: this.placeholder, maxValues: this.max, minValues: this.min }
  }
}
