// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'
import starlightChangelogs, {
  makeChangelogsSidebarLinks,
} from 'starlight-changelogs'
import starlightLinksValidator from 'starlight-links-validator'
import starlightSidebarTopics from 'starlight-sidebar-topics'

export default defineConfig({
  site: 'https://wildbeast.guide',
  redirects: {
    '/guides/getting-started/': '/self-hosting/getting-started/',
    '/guides/configuration/': '/self-hosting/configuration/',
    '/guides/redis/': '/self-hosting/redis/',
    '/guides/running-in-production/': '/self-hosting/running-in-production/',
    '/guides/troubleshooting/': '/self-hosting/troubleshooting/',
    '/scaling/clustering/': '/self-hosting/clustering/',
    '/scaling/resharding/': '/self-hosting/resharding/',
    '/observability/telemetry/': '/self-hosting/telemetry/',
    '/observability/metrics/': '/self-hosting/metrics/',
    '/observability/dashboards/': '/self-hosting/dashboards/',
    '/development/tagscript-internals/': '/tagscript/internals/',
  },
  vite: {
    resolve: {
      alias: {
        '@thesharks/tagscript/web': fileURLToPath(
          new URL('../../packages/tagscript/src/web.ts', import.meta.url),
        ),
      },
    },
  },
  integrations: [
    starlight({
      plugins: [
        // Fails the build on a broken internal link or anchor.
        starlightLinksValidator(),
        starlightChangelogs(),
        // One sidebar per audience: the bot, and each package that ships
        // on its own. The current page decides which sidebar shows.
        starlightSidebarTopics(
          [
            {
              id: 'wildbeast',
              label: 'WildBeast',
              icon: 'discord',
              link: '/using/commands/',
              items: [
                {
                  label: 'Using WildBeast',
                  items: [{ autogenerate: { directory: 'using' } }],
                },
                {
                  label: 'Self-hosting',
                  items: [{ autogenerate: { directory: 'self-hosting' } }],
                },
                {
                  label: 'Development',
                  items: [{ autogenerate: { directory: 'development' } }],
                },
                ...makeChangelogsSidebarLinks([
                  { type: 'all', base: 'changelog', label: 'Changelog' },
                ]),
              ],
            },
            {
              id: 'tagscript',
              label: 'TagScript',
              icon: 'seti:html',
              link: '/tagscript/overview/',
              items: [
                {
                  label: 'Writing tags',
                  items: [
                    'tagscript/overview',
                    'tagscript/tags',
                    'tagscript/cookbook',
                  ],
                },
                {
                  label: 'For developers',
                  items: ['tagscript/embedding', 'tagscript/internals'],
                },
                ...makeChangelogsSidebarLinks([
                  {
                    type: 'all',
                    base: 'tagscript/changelog',
                    label: 'Changelog',
                  },
                ]),
              ],
            },
            {
              id: 'analytics',
              label: 'Analytics',
              icon: 'seti:graphql',
              link: '/analytics/overview/',
              items: [
                {
                  label: 'Guides',
                  items: [{ autogenerate: { directory: 'analytics' } }],
                },
                ...makeChangelogsSidebarLinks([
                  {
                    type: 'all',
                    base: 'analytics/changelog',
                    label: 'Changelog',
                  },
                ]),
              ],
            },
          ],
          {
            // Version pages come from starlight-changelogs, not content
            // files, so tie each changelog to its topic by path.
            topics: {
              wildbeast: ['/changelog', '/changelog/**/*'],
              tagscript: ['/tagscript/changelog', '/tagscript/changelog/**/*'],
              analytics: ['/analytics/changelog', '/analytics/changelog/**/*'],
            },
          },
        ),
      ],
      title: 'WildBeast',
      favicon: '/favicon.png',
      logo: {
        replacesTitle: true,
        src: './src/assets/wildbeast.png',
      },
      customCss: ['./src/styles/custom.css'],
      expressiveCode: {
        styleOverrides: {
          borderRadius: '0.5rem',
        },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/TheSharks/WildBeast',
        },
        {
          icon: 'discord',
          label: 'Discord',
          href: 'https://discord.gg/wildbot',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/TheSharks/WildBeast/edit/feat/v9/apps/docs/',
      },
    }),
  ],
})
