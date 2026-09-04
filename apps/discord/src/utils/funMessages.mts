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

/**
 * Builders for the refreshable image commands (cat, dog, inspire). The
 * slash command and the 🔄 button handler produce the exact same message,
 * so both route through here. Payloads are Components V2.
 */

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
  // The fact service is flaky; a cat without a fact beats no cat at all.
  const fact = await fetchJson<{ fact: string }>('https://catfact.ninja/fact')
    .then((body) => body.fact)
    .catch(() => undefined)
  // The query string busts caches so every refresh is a new cat.
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
  // The media gallery only renders images; reject videos that slip past
  // the API filter instead of sending a broken message.
  if (!/\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i.test(url)) {
    throw new Error(`random.dog returned a non-image URL: ${url}`)
  }
  // The fact service has a history of dying (it already lost its .ml
  // domain once); a dog without a fact beats no dog at all.
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
