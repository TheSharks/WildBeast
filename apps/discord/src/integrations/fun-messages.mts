import { resolveKey } from '@sapphire/plugin-i18next'
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonBuilder as ButtonBuilderType,
  ButtonStyle,
  ContainerBuilder,
  type Interaction,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  TextDisplayBuilder,
} from 'discord.js'
import { fetchJson, fetchText } from './http.mjs'

/** Shared builders for refreshable image commands (Components V2). */
export type RefreshableKind = 'cat' | 'dog' | 'inspire'

function refreshRow(kind: RefreshableKind) {
  return new ActionRowBuilder<ButtonBuilderType>().addComponents(
    new ButtonBuilder()
      .setCustomId(`refresh:${kind}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄'),
  )
}

async function imageMessage(
  interaction: Interaction,
  kind: RefreshableKind,
  imageUrl: string,
  service: string,
  caption?: string,
) {
  const container = new ContainerBuilder().addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(imageUrl),
    ),
  )
  if (caption) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(caption),
    )
  }
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# ${await resolveKey(interaction, 'commands/fun:poweredBy', { service })}`,
    ),
  )
  container.addActionRowComponents(refreshRow(kind))

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { parse: [] },
  }
}

export async function buildCatMessage(interaction: Interaction) {
  // Flaky fact service; cat without fact beats no cat.
  const fact = await fetchJson<{ fact: string }>('https://catfact.ninja/fact')
    .then((body) => body.fact)
    .catch(() => undefined)
  // Query busts cache for fresh cat per refresh.
  return imageMessage(
    interaction,
    'cat',
    `https://cataas.com/cat?${interaction.id}`,
    'cataas.com',
    fact,
  )
}

export async function buildDogMessage(interaction: Interaction) {
  const { url } = await fetchJson<{ url: string }>(
    'https://random.dog/woof.json?filter=mp4,webm',
  )
  // Gallery needs images; reject videos slipping past filter.
  if (!/\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i.test(url)) {
    throw new Error(`random.dog returned a non-image URL: ${url}`)
  }
  // Fact service is unreliable; dog without fact beats no dog.
  const fact = await fetchJson<{ fact: string }>(
    'https://some-random-api.com/facts/dog',
  )
    .then((body) => body.fact)
    .catch(() => undefined)
  return imageMessage(interaction, 'dog', url, 'random.dog', fact)
}

export async function buildInspireMessage(interaction: Interaction) {
  const url = (
    await fetchText('https://inspirobot.me/api?generate=true')
  ).trim()
  return imageMessage(interaction, 'inspire', url, 'inspirobot.me')
}

export const refreshableBuilders: Record<
  RefreshableKind,
  (interaction: Interaction) => ReturnType<typeof imageMessage>
> = {
  cat: buildCatMessage,
  dog: buildDogMessage,
  inspire: buildInspireMessage,
}
