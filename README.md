<div>
  <div style="margin-left:auto;margin-right:auto;">
    <img src="assets/wildbeast.png"><br><br>
    <p align="center" style="margin:0;">
      <a href="https://github.com/TheSharks/Wildbeast/releases"><img src="https://img.shields.io/github/package-json/v/thesharks/wildbeast.svg?label=version&style=for-the-badge&maxAge=300" alt="Version"></a>
      <a href="https://discord.gg/wildbot"><img src="https://img.shields.io/discord/110462143152803840.svg?logo=discord&style=for-the-badge&maxAge=300" alt="Discord server"></a>
      <a href="https://github.com/sponsors/Dougley"><img src="https://img.shields.io/github/sponsors/Dougley.svg?logo=githubsponsors&style=for-the-badge&maxAge=300" alt="Github Sponsors"></a>
    </p>
    <p align="center" style="margin:0;">
      <a title="Crowdin" target="_blank" href="https://crowdin.com/project/wildbeast"><img src="https://img.shields.io/badge/Localization-Crowdin-blue?logo=crowdin&style=for-the-badge&maxAge=300"></a>
      <a href="https://hub.docker.com/r/dougley/wildbeast"><img src="https://img.shields.io/docker/pulls/dougley/wildbeast.svg?style=for-the-badge&maxAge=300"></a>
    </p>
  </div>
</div>

---

WildBeast is a multifunctional Discord bot, intended to provide a framework that's easy to use, extend, and modify.  
This is also the open source framework for [WildBot on Discord](https://invite.thesharks.xyz).

## Main features

- Modular by design: commands and features are pieces that can be loaded and reloaded independently
- Built to scale: autonomous sharding and clustering
- Observable: OpenTelemetry instrumentation throughout, with metrics and traces out of the box

Visit our [documentation](https://wildbeast.guide/) for more information.

### Want to use WildBeast but don't want to host it yourself?

No problem, we maintain a public instance called WildBot that you can invite to your server! Visit https://invite.thesharks.xyz to get started!

### Want to run WildBeast yourself?

We've got you covered on that, check out the [getting started guide](https://wildbeast.guide/self-hosting/getting-started/).

## Repository layout

This is a pnpm workspace managed with [Turborepo](https://turborepo.dev/):

| Path                  | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `apps/discord`        | The Discord bot, built on [Sapphire](https://sapphirejs.dev/) and [discord.js](https://discord.js.org/) |
| `apps/docs`           | The documentation site, built with [Starlight](https://starlight.astro.build/) |
| `packages/analytics`  | OpenTelemetry-based analytics                        |
| `packages/drizzle`    | Database client and schema ([Drizzle ORM](https://orm.drizzle.team/)) |
| `packages/tagscript`  | TagScript interpreter                                |
| `packages/test-utils` | Shared test helpers                                  |
| `packages/tsconfig`   | Shared TypeScript configuration                      |

## Development

Requirements: Node.js 22 or newer and [pnpm](https://pnpm.io/). A [devcontainer](.devcontainer) is included that provides PostgreSQL (TimescaleDB), Redis, and an OpenTelemetry collector out of the box.

```bash
pnpm install   # install dependencies
pnpm dev       # start everything in watch mode
pnpm build     # build all workspaces
pnpm test      # run tests
pnpm lint      # check style and lint rules (Biome)
```

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for contribution guidelines.

---

"Discord", "Discord App", and any associated logos are registered trademarks of Discord, inc.
