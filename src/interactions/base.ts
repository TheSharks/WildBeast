import { Constants, Interaction, Structures } from 'detritus-client'
import { t } from '../internal/i18n'
import { error } from '../internal/logger'
const { ApplicationCommandTypes, ApplicationCommandOptionTypes, MessageFlags } = Constants

export class BaseInteractionCommand<ParsedArgsFinished = Interaction.ParsedArgs> extends Interaction.InteractionCommand<ParsedArgsFinished> {
  async onDmBlocked (context: Interaction.InteractionContext): Promise<void> {
    return await context.editOrRespond({
      content: t('commands.common.dmDisabled'),
      flags: MessageFlags.EPHEMERAL
    })
  }

  async onRunError (context: Interaction.InteractionContext, args: ParsedArgsFinished, err: any): Promise<void> {
    const uuid = error(err, context.name)
    return await context.editOrRespond({
      content: t('commands.common.failedToRun', { uuid }),
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
