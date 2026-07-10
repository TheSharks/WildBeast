// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  site: 'https://thesharks.github.io',
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
          href: 'https://discord.gg/8wjT9Av',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/TheSharks/WildBeast/edit/master/apps/docs/',
      },
      sidebar: [
        {
          label: 'Using WildBeast',
          items: [{ autogenerate: { directory: 'using' } }],
        },
        {
          label: 'TagScript',
          items: [{ autogenerate: { directory: 'tagscript' } }],
        },
        {
          label: 'Self-hosting',
          items: [{ autogenerate: { directory: 'self-hosting' } }],
        },
        {
          label: 'Development',
          items: [{ autogenerate: { directory: 'development' } }],
        },
      ],
    }),
  ],
})
