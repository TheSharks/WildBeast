import { InteractionHandler } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import { type Interaction, MessageFlags } from 'discord.js'
import { commandComponentEnabled } from '../features/gates.mjs'

/**
 * Framework-level command gate for stateless interaction handlers. A button
 * can be clicked long after its originating command ran, so the command's
 * preconditions cannot protect it. Subclasses declare which command owns
 * the component and implement run normally; disabled interactions get the
 * same localized reply a denied command invocation would.
 */
export interface GatedCommandInteractionHandlerOptions
  extends InteractionHandler.Options {
  command: string | ((parsedData: unknown) => string)
}

export abstract class GatedCommandInteractionHandler<
  Options extends
    GatedCommandInteractionHandlerOptions = GatedCommandInteractionHandlerOptions,
> extends InteractionHandler<Options> {
  public constructor(
    context: InteractionHandler.LoaderContext,
    options: Options,
  ) {
    super(context, options)

    const run = this.run.bind(this)
    this.run = async (interaction, parsedData) => {
      const command =
        typeof options.command === 'function'
          ? options.command(parsedData)
          : options.command
      if (await commandComponentEnabled(interaction, command)) {
        return run(interaction, parsedData)
      }
      if (
        interaction.isMessageComponent() &&
        !interaction.replied &&
        !interaction.deferred
      ) {
        return interaction.reply({
          content: (await resolveKey(
            interaction,
            'system/errors:feature_unavailable',
          )) as string,
          flags: MessageFlags.Ephemeral,
        })
      }
      return undefined
    }
  }

  public abstract override run(
    interaction: Interaction,
    parsedData?: unknown,
  ): unknown
}
