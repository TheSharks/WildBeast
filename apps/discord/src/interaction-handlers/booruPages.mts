import { ApplyOptions } from '@sapphire/decorators'
import { InteractionHandlerTypes } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import {
  type ButtonInteraction,
  MessageFlags,
  TextDisplayBuilder,
} from 'discord.js'
import {
  GatedCommandInteractionHandler,
  type GatedCommandInteractionHandlerOptions,
} from '../structures/interactionHandler.mjs'
import {
  BOORU_CUSTOM_ID_PREFIX,
  type BooruSiteName,
  booruSites,
  buildBooruPage,
  channelAllowsNsfw,
  isBooruSiteName,
} from '../utils/booru.mjs'

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

  public async run(interaction: ButtonInteraction, action: BooruPageAction) {
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
      let content: string
      try {
        content = (await resolveKey(
          interaction,
          'system/errors:try_again',
        )) as string
      } catch {
        content = 'Something went wrong. Try again later.'
      }
      return interaction.editReply({
        components: [new TextDisplayBuilder().setContent(content)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      })
    }
  }
}
