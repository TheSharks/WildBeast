import { container, InteractionHandler } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import { type Interaction, MessageFlags } from 'discord.js'
import { WorkRejected } from '../runtime/work.mjs'

export interface GatedCommandInteractionHandlerOptions
  extends InteractionHandler.Options {
  /** The command whose gate protects this component. */
  command: string | ((parsedData: unknown) => string)
}

/**
 * Components outlive the command that produced them, so the command's
 * preconditions cannot protect them; the shared gate does, and every run is
 * admitted through the runtime.
 */
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
      try {
        return await container.app.work.run(async () => {
          const evaluation = await container.app.gates.evaluateInteraction(
            interaction,
            command,
          )
          if (evaluation.flagEnabled && evaluation.premiumAllowed)
            return run(interaction, parsedData)
          return this.deny(interaction)
        })
      } catch (error) {
        if (error instanceof WorkRejected) return this.deny(interaction)
        throw error
      }
    }
  }

  private async deny(interaction: Interaction) {
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

  public abstract override run(
    interaction: Interaction,
    parsedData?: unknown,
  ): unknown
}
