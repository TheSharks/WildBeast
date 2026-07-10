import { ApplyOptions } from '@sapphire/decorators'
import { InteractionHandlerTypes } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import { type ButtonInteraction, TextDisplayBuilder } from 'discord.js'
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

/**
 * Pagination for /booru. Stateless like the Urban Dictionary pager: the
 * custom id (`booru:<site>:<page>:<query>`) carries everything needed to
 * refetch, so buttons work across restarts.
 */
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

    const nsfwAllowed = channelAllowsNsfw(interaction)
    const message = async (key: string) => ({
      // The message carries IsComponentsV2, which can't be unset, so
      // fallbacks must stay components rather than plain content.
      components: [
        new TextDisplayBuilder().setContent(
          (await resolveKey(interaction, key, {
            query: action.query,
          })) as string,
        ),
      ],
    })

    // A message can outlive its channel being flipped back to SFW.
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
        : action.position

    return interaction.editReply(
      await buildBooruPage(
        interaction,
        action.site,
        action.query,
        posts,
        position,
      ),
    )
  }
}
