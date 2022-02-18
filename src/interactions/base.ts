import { Constants, Interaction, Structures } from 'detritus-client'
import { add } from '../utils/elastic'
import { translate } from '../utils/i18n'
import { error } from '../utils/logger'
const { ApplicationCommandTypes, ApplicationCommandOptionTypes, MessageFlags, Permissions } = Constants

export class BaseInteractionCommand<ParsedArgsFinished = Interaction.ParsedArgs> extends Interaction.InteractionCommand<ParsedArgsFinished> {
  translate: typeof translate = translate
  translateThis: typeof translate = (key, args) =>
    this.translate(`slash-commands.${this.name.toLowerCase()}.${key}`, args)

  async onBefore (context: Interaction.InteractionContext): Promise<boolean> {
    if (context.locale !== undefined) {
      this.translate = (key, args) => translate(key, args, context.locale)
    }
    return true
  }

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
      content: this.translate('common.dmDisabled'),
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onPermissionsFail (context: Interaction.InteractionContext, falied: bigint[]): Promise<void> {
    const values = Object.entries(Permissions).filter(([key, value]) => falied.includes(BigInt(value)))
    await context.editOrRespond({
      content: this.translate('common.permsMissingUser', {
        perms: values.map(([key]) => key).join(', ')
      }),
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onPermissionsFailClient (context: Interaction.InteractionContext, falied: bigint[]): Promise<void> {
    const values = Object.entries(Permissions).filter(([key, value]) => falied.includes(BigInt(value)))
    await context.editOrRespond({
      content: this.translate('common.permsMissingOwn', {
        perms: values.map(([key]) => key).join(', ')
      }),
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onRatelimit (context: Interaction.InteractionContext): Promise<void> {
    await context.editOrRespond({
      content: this.translate('common.cooldown'),
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
      content: translate('common.failedToRun', { uuid }),
      flags: MessageFlags.EPHEMERAL
    })
  }
}

class OptionBase<ParsedArgsFinished = Interaction.ParsedArgs> extends Interaction.InteractionCommandOption<ParsedArgsFinished> {
  translate: typeof translate = translate
  translateThis: typeof translate = (key, args) =>
    this.translate(`context-menu.${this.name.toLowerCase()}.${key}`, args)

  async onBefore (context: Interaction.InteractionContext): Promise<boolean> {
    if (context.locale !== undefined) {
      this.translate = (key, args) => translate(key, args, context.locale)
    }
    return true
  }

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
      content: this.translate('common.dmDisabled'),
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onPermissionsFail (context: Interaction.InteractionContext, falied: bigint[]): Promise<void> {
    const values = Object.entries(Permissions).filter(([key, value]) => falied.includes(BigInt(value)))
    await context.editOrRespond({
      content: this.translate('common.permsMissingUser', {
        perms: values.map(([key]) => key).join(', ')
      }),
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onPermissionsFailClient (context: Interaction.InteractionContext, falied: bigint[]): Promise<void> {
    const values = Object.entries(Permissions).filter(([key, value]) => falied.includes(BigInt(value)))
    await context.editOrRespond({
      content: this.translate('common.permsMissingOwn', {
        perms: values.map(([key]) => key).join(', ')
      }),
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onRatelimit (context: Interaction.InteractionContext): Promise<void> {
    await context.editOrRespond({
      content: this.translate('common.cooldown'),
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
      content: translate('common.failedToRun', { uuid }),
      flags: MessageFlags.EPHEMERAL
    })
  }
}

export class BaseCommandOption<ParsedArgsFinished = Interaction.ParsedArgs> extends OptionBase<ParsedArgsFinished> {
  type = ApplicationCommandOptionTypes.SUB_COMMAND
}

export class BaseCommandOptionGroup<ParsedArgsFinished = Interaction.ParsedArgs> extends OptionBase<ParsedArgsFinished> {
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
