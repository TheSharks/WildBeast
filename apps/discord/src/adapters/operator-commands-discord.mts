import { type Client, DiscordAPIError, RESTJSONErrorCodes } from 'discord.js'
import type {
  OperatorCommandData,
  OperatorCommandGateway,
} from '../operators/service.mjs'

export class DiscordOperatorCommands implements OperatorCommandGateway {
  private readonly client: () => Client<true>

  public constructor(client: Client<true> | (() => Client<true>)) {
    this.client = typeof client === 'function' ? client : () => client
  }

  public async create(guildId: bigint, data: OperatorCommandData) {
    const command = await this.client().application.commands.create(
      data,
      guildId.toString(),
    )
    return BigInt(command.id)
  }

  public async update(
    guildId: bigint,
    commandId: bigint,
    data: OperatorCommandData,
  ) {
    try {
      await this.client().application.commands.edit(
        commandId.toString(),
        data,
        guildId.toString(),
      )
      return true
    } catch (error) {
      if (
        error instanceof DiscordAPIError &&
        error.code === RESTJSONErrorCodes.UnknownApplicationCommand
      )
        return false
      throw error
    }
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
