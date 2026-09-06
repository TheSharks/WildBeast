import {
  ApplicationCommandOptionType,
  type Client,
  DiscordAPIError,
  RESTJSONErrorCodes,
} from 'discord.js'
import type { CommandIntent, TagCommandGateway } from '../tags/model.mjs'

function payload(intent: CommandIntent) {
  return {
    name: intent.name,
    description: intent.description,
    options: [
      {
        name: 'args',
        description: intent.argsDescription,
        type: ApplicationCommandOptionType.String as const,
        required: false,
      },
    ],
  }
}

export class DiscordTagCommands implements TagCommandGateway {
  private readonly client: () => Client<true>

  /** Accepts a getter so the adapter can exist before login completes. */
  public constructor(client: Client<true> | (() => Client<true>)) {
    this.client = typeof client === 'function' ? client : () => client
  }

  public async list(guildId: bigint) {
    const commands = await this.client().application.commands.fetch({
      guildId: guildId.toString(),
    })
    return [...commands.values()].map((command) => {
      const option = command.options[0]
      const tagShape =
        command.options.length === 1 &&
        option?.name === 'args' &&
        option.type === ApplicationCommandOptionType.String &&
        option.required !== true
      return {
        id: BigInt(command.id),
        name: command.name,
        description: command.description,
        tagShape,
        argsDescription: tagShape ? option.description : null,
      }
    })
  }

  public async create(guildId: bigint, intent: CommandIntent) {
    const command = await this.client().application.commands.create(
      payload(intent),
      guildId.toString(),
    )
    return BigInt(command.id)
  }

  public async update(
    guildId: bigint,
    commandId: bigint,
    intent: CommandIntent,
  ) {
    await this.client().application.commands.edit(
      commandId.toString(),
      payload(intent),
      guildId.toString(),
    )
  }

  public async delete(guildId: bigint, commandId: bigint) {
    try {
      await this.client().application.commands.delete(
        commandId.toString(),
        guildId.toString(),
      )
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        error.code === RESTJSONErrorCodes.UnknownApplicationCommand
      )
        return
      throw error
    }
  }
}
