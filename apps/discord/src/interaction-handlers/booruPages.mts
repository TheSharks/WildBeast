import { ApplyOptions } from '@sapphire/decorators'
import { InteractionHandlerTypes } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import {
  type ButtonInteraction,
  MessageFlags,
  TextDisplayBuilder,
} from 'discord.js'
import {
  BOORU_CUSTOM_ID_PREFIX,
  type BooruSiteName,
  booruSites,
  buildBooruPage,
  channelAllowsNsfw,
  isBooruSiteName,
} from '../integrations/booru.mjs'
import {
  GatedCommandInteractionHandler,
  type GatedCommandInteractionHandlerOptions,
} from '../structures/interactionHandler.mjs'
import { editReplyTryAgain } from '../utils/replies.mjs'

interface BooruPageAction {
  site: BooruSiteName
  query: string
  position: number | 'random'
}

/** Stateless /booru pagination; custom id carries site+page+query for refetch. */
@ApplyOptions<GatedCommandInteractionHandlerOptions>({
  interactionHandlerType: InteractionHandlerTypes.Button,
  command: 'booru',
})
export class BooruPagesHandler extends GatedCommandInteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith(BOORU_CUSTOM_ID_PREFIX)) {
      return this.none()
    }
    const [site, target, ...queryParts] = interaction.customId
      .slice(BOORU_CUSTOM_ID_PREFIX.length)
      .split(':')
    if (!site || !isBooruSiteName(site) || target === undefined) {
      return this.none()
    }
    return this.some<BooruPageAction>({
      site,
      query: queryParts.join(':'),
      position: target === 'rnd' ? 'random' : Number(target),
    })
  }

  protected override async execute(
    interaction: ButtonInteraction,
    action: BooruPageAction,
  ) {
    await interaction.deferUpdate()

    try {
      const nsfwAllowed = channelAllowsNsfw(interaction)
      // Escape backticks to block formatting breakout.
      const safeQuery = action.query.replace(/`/g, '\\`')
      const message = async (key: string) => ({
        // V2 flag is sticky; fallbacks must stay components.
        components: [
          new TextDisplayBuilder().setContent(
            (await resolveKey(interaction, key, {
              query: safeQuery,
            })) as string,
          ),
        ],
        flags: MessageFlags.IsComponentsV2 as const,
        allowedMentions: { parse: [] },
      })

      // Recheck NSFW: channel may have flipped SFW since render.
      if (booruSites[action.site].gated && !nsfwAllowed) {
        return interaction.editReply(
          await message('commands/common:nsfwDisabled'),
        )
      }

      const posts = await booruSites[action.site].search(
        action.query,
        nsfwAllowed,
      )
      if (posts.length === 0) {
        return interaction.editReply(
          await message('commands/common:noResultsFor'),
        )
      }

      const position =
        action.position === 'random'
          ? Math.floor(Math.random() * posts.length)
          : Number.isInteger(action.position)
            ? action.position
            : 0

      return interaction.editReply(
        await buildBooruPage(
          interaction,
          action.site,
          action.query,
          posts,
          position,
        ),
      )
    } catch {
      return editReplyTryAgain(interaction)
    }
  }
}
