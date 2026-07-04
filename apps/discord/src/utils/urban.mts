import { resolveKey } from '@sapphire/plugin-i18next'
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonBuilder as ButtonBuilderType,
  ButtonStyle,
  ContainerBuilder,
  type Interaction,
  MessageFlags,
  TextDisplayBuilder,
} from 'discord.js'
import { fetchJson } from './http.mjs'

export interface UrbanDefinition {
  word: string
  definition: string
  example: string
  permalink: string
  thumbs_up: number
  thumbs_down: number
}

/**
 * The query rides along in button custom ids (`urban:<page>:<query>`), so
 * pagination is stateless: every click refetches. Custom ids cap at 100
 * characters, hence the query option's max length of 80.
 */
export const URBAN_CUSTOM_ID_PREFIX = 'urban:'
export const URBAN_QUERY_MAX_LENGTH = 80

const MAX_FIELD_LENGTH = 1_000

export async function fetchDefinitions(
  query: string,
): Promise<UrbanDefinition[]> {
  const { list } = await fetchJson<{ list: UrbanDefinition[] }>(
    `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(query)}`,
  )
  return list
}

export async function fetchCompletions(term: string): Promise<string[]> {
  return fetchJson<string[]>(
    `https://api.urbandictionary.com/v0/autocomplete?term=${encodeURIComponent(term)}`,
  )
}

/**
 * Urban Dictionary cross-references terms in [brackets]; turn them into
 * links like the website does.
 */
function stylize(text: string): string {
  return text.replace(
    /\[([^\]]+)\]/g,
    (_, term: string) =>
      `[${term}](https://www.urbandictionary.com/define.php?term=${encodeURIComponent(term)})`,
  )
}

function clip(text: string): string {
  return text.length > MAX_FIELD_LENGTH
    ? `${text.slice(0, MAX_FIELD_LENGTH - 1)}…`
    : text
}

export async function buildUrbanPage(
  interaction: Interaction,
  query: string,
  definitions: UrbanDefinition[],
  position: number,
) {
  const page = Math.min(Math.max(position, 0), definitions.length - 1)
  const entry = definitions[page]

  const example =
    entry.example.length > 0
      ? stylize(clip(entry.example))
      : ((await resolveKey(
          interaction,
          'commands/urbandictionary:noExample',
        )) as string)

  const container = new ContainerBuilder()
    .setAccentColor(0x6832e3)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## [${entry.word}](${entry.permalink})`,
      ),
      new TextDisplayBuilder().setContent(stylize(clip(entry.definition))),
      new TextDisplayBuilder().setContent(
        [
          `**${await resolveKey(interaction, 'commands/urbandictionary:example')}:** ${example}`,
          `-# 👍 ${entry.thumbs_up} · 👎 ${entry.thumbs_down} · ${page + 1}/${definitions.length}`,
        ].join('\n'),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilderType>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${URBAN_CUSTOM_ID_PREFIX}${page - 1}:${query}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('◀️')
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`${URBAN_CUSTOM_ID_PREFIX}${page + 1}:${query}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('▶️')
          .setDisabled(page === definitions.length - 1),
        new ButtonBuilder()
          .setCustomId(`${URBAN_CUSTOM_ID_PREFIX}rnd:${query}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔀'),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(
            (await resolveKey(interaction, 'commands/fun:open')) as string,
          )
          .setURL(entry.permalink),
      ),
    )

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
  }
}
