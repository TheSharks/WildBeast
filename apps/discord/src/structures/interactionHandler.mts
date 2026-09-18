import { container, InteractionHandler } from '@sapphire/framework'
import type { Interaction } from 'discord.js'
import { WorkRejected } from '../runtime/work.mjs'
import { replyFeatureUnavailable } from '../utils/replies.mjs'

export interface GatedCommandInteractionHandlerOptions
  extends InteractionHandler.Options {
  /** The command whose gate protects this component. */
  command: string | ((parsedData: unknown) => string)
}

/**
 * Base class for component handlers. Components outlive the command that
 * produced them, so the command's preconditions cannot protect them. Implement
 * `execute` instead of Sapphire's `run`: this class owns `run`, admits every
 * run through the runtime and checks the owning command's gate first.
 */
export abstract class GatedCommandInteractionHandler<
  Options extends
    GatedCommandInteractionHandlerOptions = GatedCommandInteractionHandlerOptions,
> extends InteractionHandler<Options> {
  private readonly gatedCommand: GatedCommandInteractionHandlerOptions['command']

  public constructor(
    context: InteractionHandler.LoaderContext,
    options: Options,
  ) {
    super(context, options)
    this.gatedCommand = options.command
  }

  /** The handler body; receives what `parse` returned. */
  protected abstract execute(
    interaction: Interaction,
    parsedData?: unknown,
  ): unknown

  public override async run(interaction: Interaction, parsedData?: unknown) {
    const command =
      typeof this.gatedCommand === 'function'
        ? this.gatedCommand(parsedData)
        : this.gatedCommand
    try {
      return await container.app.work.run(async () => {
        const evaluation = await container.app.gates.evaluateInteraction(
          interaction,
          command,
        )
        if (evaluation.flagEnabled && evaluation.premiumAllowed)
          return this.execute(interaction, parsedData)
        return this.deny(interaction)
      })
    } catch (error) {
      if (error instanceof WorkRejected) return this.deny(interaction)
      throw error
    }
  }

  private async deny(interaction: Interaction) {
    if (interaction.isMessageComponent())
      await replyFeatureUnavailable(interaction)
  }
}
