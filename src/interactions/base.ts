import { Constants, Interaction, Structures } from 'detritus-client'
import { add } from '../utils/elastic'
import { translate } from '../utils/i18n'
import { error } from '../utils/logger'
const { ApplicationCommandTypes, ApplicationCommandOptionTypes, MessageFlags, Permissions } = Constants

export class BaseInteractionCommand<ParsedArgsFinished = Interaction.ParsedArgs> extends Interaction.InteractionCommand<ParsedArgsFinished> {
  async onSuccess (context: Interaction.InteractionContext, args: ParsedArgsFinished): Promise<void> {
    add({
      type: 'command',
      guildId: context.guildId,
      inDm: context.inDm,
      userId: context.user.id,
      data: {
        args,
        interaction_id: context.interactionId
      },
      name: context.command.name
    })
  }

  async onDmBlocked (context: Interaction.InteractionContext): Promise<unknown> {
    return await context.editOrRespond({
      content: translate('commands.common.dmDisabled'),
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onPermissionsFail (context: Interaction.InteractionContext, falied: bigint[]): Promise<void> {
    const values = Object.entries(Permissions).filter(([key, value]) => falied.includes(BigInt(value)))
    await context.editOrRespond({
      content:
        "You're missing the following permissions for this command to work:\n" +
        values.map(([key, value]) => `\`${key}\``).join('\n'),
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onPermissionsFailClient (context: Interaction.InteractionContext, falied: bigint[]): Promise<void> {
    const values = Object.entries(Permissions).filter(([key, value]) => falied.includes(BigInt(value)))
    await context.editOrRespond({
      content:
        "I'm missing the following permissions for this command to work:\n" +
        values.map(([key, value]) => `\`${key}\``).join('\n'),
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onRatelimit (context: Interaction.InteractionContext): Promise<void> {
    await context.editOrRespond({
      content: 'You are doing that too much, please wait a bit.',
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onRunError (context: Interaction.InteractionContext, args: ParsedArgsFinished, err: any): Promise<unknown> {
    const uuid = error(err, context.name, {
      user: {
        id: context.user.id,
        username: context.user.username
      },
      contexts: {
        guild: {
          id: context.guildId,
          name: context.guild?.name
        },
        command: {
          name: context.command.name,
          args
        }
      }
    })
    return await context.editOrRespond({
      content: translate('commands.common.failedToRun', { uuid }),
      flags: MessageFlags.EPHEMERAL
    })
  }
}

export class BaseCommandOption<ParsedArgsFinished = Interaction.ParsedArgs> extends Interaction.InteractionCommandOption<ParsedArgsFinished> {
  type = ApplicationCommandOptionTypes.SUB_COMMAND
}

export class BaseCommandOptionGroup<ParsedArgsFinished = Interaction.ParsedArgs> extends Interaction.InteractionCommandOption<ParsedArgsFinished> {
  type = ApplicationCommandOptionTypes.SUB_COMMAND_GROUP
}

export class BaseSlashCommand<ParsedArgsFinished = Interaction.ParsedArgs> extends BaseInteractionCommand<ParsedArgsFinished> {
  type = ApplicationCommandTypes.CHAT_INPUT
}

export interface ContextMenuMessageArgs {
  message: Structures.Message
}

export class BaseContextMenuMessageCommand extends BaseInteractionCommand<ContextMenuMessageArgs> {
  type = ApplicationCommandTypes.MESSAGE
}

export interface ContextMenuUserArgs {
  member?: Structures.Member
  user: Structures.User
}

export class BaseContextMenuUserCommand extends BaseInteractionCommand<ContextMenuUserArgs> {
  type = ApplicationCommandTypes.USER
}
