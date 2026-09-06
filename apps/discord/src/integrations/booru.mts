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
import { fetchJson, postJson } from './http.mjs'

/** One adapter per booru normalizing APIs to a shared post shape. */
export interface BooruPost {
  imageUrl: string
  pageUrl: string
  author?: { name: string; url?: string }
  /** Preformatted stats, e.g. `👍 12 · 👎 3 · ⭐ 4`. */
  stats?: string
}

export interface BooruSite {
  /** True requires NSFW channel/DM. */
  gated: boolean
  footer: (nsfwAllowed: boolean) => string
  search: (query: string, nsfwAllowed: boolean) => Promise<BooruPost[]>
  autocomplete: (term: string, nsfwAllowed: boolean) => Promise<string[]>
}

export const BOORU_CUSTOM_ID_PREFIX = 'booru:'
export const BOORU_QUERY_MAX_LENGTH = 75

/** Media gallery renders images only. */
const IMAGE_URL = /\.(?:png|jpe?g|gif|webp)$/i

interface E621Response {
  posts: {
    id: number
    file: { url: string | null; ext: string }
    score: { up: number; down: number }
    fav_count: number
    tags: { artist: string[] }
  }[]
}

const e621: BooruSite = {
  // SFW served via e926 mirror.
  gated: false,
  footer: (nsfwAllowed) => (nsfwAllowed ? 'e621.net' : 'e926.net'),
  async search(query, nsfwAllowed) {
    const domain = nsfwAllowed ? 'e621.net' : 'e926.net'
    const params = new URLSearchParams({ limit: '50', tags: query })
    const { posts } = await fetchJson<E621Response>(
      `https://${domain}/posts.json?${params}`,
    )
    return posts
      .filter(
        (post) =>
          post.file.url !== null &&
          ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(post.file.ext),
      )
      .map((post) => {
        const artist = post.tags.artist.filter(
          (name) => name !== 'conditional_dnp',
        )[0]
        return {
          imageUrl: post.file.url as string,
          pageUrl: `https://${domain}/posts/${post.id}`,
          author: artist
            ? {
                name: artist,
                url: `https://${domain}/artists/show_or_new?name=${encodeURIComponent(artist)}`,
              }
            : undefined,
          stats: `👍 ${post.score.up} · 👎 ${Math.abs(post.score.down)} · ⭐ ${post.fav_count}`,
        }
      })
  },
  async autocomplete(term, nsfwAllowed) {
    const domain = nsfwAllowed ? 'e621.net' : 'e926.net'
    const params = new URLSearchParams({
      'search[name_matches]': term,
      expiry: '7',
    })
    const tags = await fetchJson<{ name: string }[]>(
      `https://${domain}/tags/autocomplete.json?${params}`,
    )
    return tags.map((tag) => tag.name)
  },
}

const PAHEAL_POSTS_QUERY = `
  query ($tags: [String!], $limit: Int!) {
    posts(tags: $tags, limit: $limit, offset: 0) {
      post_id
      image_link
      ext
      score
      owner { name }
    }
  }
`

interface PahealResponse {
  data?: {
    posts: {
      post_id: number
      image_link: string
      ext: string
      score: number
      owner: { name: string }
    }[]
  }
}

const rule34: BooruSite = {
  gated: true,
  footer: () => 'rule34.paheal.net',
  async search(query) {
    // Shimmie2 XML endpoint lacks JSON; use GraphQL extension.
    const { data } = await postJson<PahealResponse>(
      'https://rule34.paheal.net/graphql',
      {
        query: PAHEAL_POSTS_QUERY,
        variables: { tags: query.split(/\s+/).filter(Boolean), limit: 50 },
      },
    )
    return (data?.posts ?? [])
      .filter((post) =>
        ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(post.ext.toLowerCase()),
      )
      .map((post) => ({
        imageUrl: post.image_link,
        pageUrl: `https://rule34.paheal.net/post/view/${post.post_id}`,
        author: { name: post.owner.name },
        stats: `👍 ${post.score}`,
      }))
  },
  async autocomplete(term) {
    const params = new URLSearchParams({ s: term })
    const tags = await fetchJson<Record<string, unknown>>(
      `https://rule34.paheal.net/api/internal/autocomplete?${params}`,
    )
    return Object.keys(tags)
  },
}

interface DerpibooruResponse {
  images: {
    id: number
    representations: { full: string }
    upvotes: number
    downvotes: number
    faves: number
    source_url: string | null
    tags: string[]
  }[]
}

const derpibooru: BooruSite = {
  gated: true,
  footer: () => 'derpibooru.org',
  async search(query) {
    const params = new URLSearchParams({ q: query, per_page: '50' })
    const { images } = await fetchJson<DerpibooruResponse>(
      `https://derpibooru.org/api/v1/json/search/images?${params}`,
    )
    return images
      .filter((image) => IMAGE_URL.test(image.representations.full))
      .map((image) => {
        const artist = image.tags
          .find((tag) => tag.startsWith('artist:'))
          ?.slice('artist:'.length)
        return {
          imageUrl: image.representations.full,
          pageUrl: `https://derpibooru.org/images/${image.id}`,
          author: artist
            ? { name: artist, url: image.source_url ?? undefined }
            : undefined,
          stats: `👍 ${image.upvotes} · 👎 ${image.downvotes} · ⭐ ${image.faves}`,
        }
      })
  },
  async autocomplete() {
    return []
  },
}

export const booruSites = { e621, rule34, derpibooru } as const

export type BooruSiteName = keyof typeof booruSites

export function isBooruSiteName(value: string): value is BooruSiteName {
  return value in booruSites
}

/** DMs count as NSFW; threads inherit parent. */
export function channelAllowsNsfw(interaction: Interaction): boolean {
  const { channel } = interaction
  if (!channel) return false
  if (channel.isDMBased()) return true
  if (channel.isThread()) {
    const parent = channel.parent
    return parent !== null && 'nsfw' in parent && parent.nsfw
  }
  return 'nsfw' in channel && channel.nsfw
}

export async function buildBooruPage(
  interaction: Interaction,
  site: BooruSiteName,
  query: string,
  posts: BooruPost[],
  position: number,
) {
  const page = Math.min(Math.max(position, 0), posts.length - 1)
  const post = posts[page]
  const nsfwAllowed = channelAllowsNsfw(interaction)

  const container = new ContainerBuilder()
  if (post.author) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        post.author.url
          ? `## [${post.author.name}](${post.author.url})`
          : `## ${post.author.name}`,
      ),
    )
  }
  container
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(post.imageUrl),
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${[
          post.stats,
          `${page + 1}/${posts.length}`,
          booruSites[site].footer(nsfwAllowed),
        ]
          .filter(Boolean)
          .join(' · ')}`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilderType>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${BOORU_CUSTOM_ID_PREFIX}${site}:${page - 1}:${query}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('◀️')
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`${BOORU_CUSTOM_ID_PREFIX}${site}:${page + 1}:${query}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('▶️')
          .setDisabled(page === posts.length - 1),
        new ButtonBuilder()
          .setCustomId(`${BOORU_CUSTOM_ID_PREFIX}${site}:rnd:${query}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔀'),
        new ButtonBuilder()
          .setCustomId('close')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✖️'),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(
            (await resolveKey(interaction, 'commands/fun:open')) as string,
          )
          .setURL(post.pageUrl),
      ),
    )

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { parse: [] },
  }
}
