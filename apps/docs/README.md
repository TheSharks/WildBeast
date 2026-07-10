# WildBeast documentation

Documentation site for WildBeast, built with [Starlight](https://starlight.astro.build/) on [Astro](https://astro.build/).

## Commands

All commands are run from this directory (or via turbo from the repo root):

| Command        | Action                                       |
| -------------- | -------------------------------------------- |
| `pnpm dev`     | Start the local dev server at `localhost:4321` |
| `pnpm build`   | Build the production site to `./dist/`       |
| `pnpm preview` | Preview the production build locally         |

## Adding content

Pages are Markdown or MDX files in `src/content/docs/`. The sidebar picks up files in `using/`, `tagscript/`, `self-hosting/`, and `development/` automatically, ordered by their `sidebar.order` frontmatter. See the [Starlight docs](https://starlight.astro.build/guides/authoring-content/) for authoring details.
