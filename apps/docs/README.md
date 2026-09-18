# WildBeast documentation

The WildBeast documentation site uses
[Starlight](https://starlight.astro.build/) on [Astro](https://astro.build/).

## Commands

Run these commands from `apps/docs`. From the repository root, prefix them
with `pnpm --filter @thesharks/docs`, for example
`pnpm --filter @thesharks/docs build`.

| Command | Action |
| --- | --- |
| `pnpm dev` | Start the local development server at `localhost:4321`. |
| `pnpm build` | Build the production site to `dist/`. |
| `pnpm preview` | Preview the production build locally. |

## Adding content

Add Markdown or MDX pages under `src/content/docs/`. Each page needs `title`,
`description`, and `sidebar.order` frontmatter. The sidebar automatically
includes pages in `using/`, `tagscript/`, `self-hosting/`, and `development/`,
ordered by `sidebar.order`.

Follow the [documentation guide](./AGENTS.md) for voice, formatting, source
checks, and validation. The
[Starlight authoring guide](https://starlight.astro.build/guides/authoring-content/)
covers Markdown, MDX, and component usage.
