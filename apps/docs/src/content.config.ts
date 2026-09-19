import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'
import { defineCollection } from 'astro:content'
import { changelogsLoader } from 'starlight-changelogs/loader'

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // Rendered straight from the CHANGELOG.md files Changesets writes on
  // release, so the pages update with no docs edit. Paths are relative
  // to apps/docs.
  changelogs: defineCollection({
    loader: changelogsLoader([
      {
        provider: 'changeset',
        base: 'changelog',
        title: 'WildBeast changelog',
        changelog: '../discord/CHANGELOG.md',
      },
      {
        provider: 'changeset',
        base: 'tagscript/changelog',
        title: 'TagScript changelog',
        changelog: '../../packages/tagscript/CHANGELOG.md',
      },
      {
        provider: 'changeset',
        base: 'analytics/changelog',
        title: 'Analytics changelog',
        changelog: '../../packages/analytics/CHANGELOG.md',
      },
    ]),
  }),
}
