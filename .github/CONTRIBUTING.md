Thank you for taking the time to contribute to the development of WildBeast!

Follow these rules when making contributions to this repository. The
[development guide](https://wildbeast.guide/development/environment/) covers
setting up an environment, and the
[command cookbook](https://wildbeast.guide/development/command-cookbook/) walks
through adding a command step by step.

# Source code

## Unwanted contributions

1. Changes to lint or formatter configuration without justifiable reason
2. New commands that are confusing to use for end users
3. Breaking changes to already existing commands, unless strictly necessary
4. Unnecessarily large restructurings of code

## Code rules

### Verified as working

All code contributed to this repository must be verified as working, meaning you've tested the functionality at least once and didn't encounter unexpected behaviour.  
Keep in mind that we might ask you to confirm if this is the case.

### Style enforcement

[Biome](https://biomejs.dev/) handles our style enforcement and linting. When making contributions, confirm your code adheres to the style; your build will fail otherwise and we're less inclined to merge it.  
To verify your code adheres to our styleguide, run `pnpm lint` in the project root. Most issues can be fixed automatically with `pnpm check:fix`.

### Tests

Run `pnpm test` in the project root to build the workspace and run the unit tests. Integration tests (`pnpm test:integration`) require Docker and are also run in CI.
See [Testing](https://wildbeast.guide/development/testing/) for the test helpers and what each suite covers.

### Changesets

Versions and changelogs come from [changesets](https://github.com/changesets/changesets). When your change affects the bot or a published package (`@thesharks/analytics`, `@thesharks/tagscript`), run `pnpm changeset` in the project root, pick the affected packages and the bump type, and commit the generated file with your pull request.
Changes to documentation, tests, or tooling don't need one.

## Code practices

### Translations

All user-facing text, meaning text that gets sent to Discord and is displayed to end users, needs to be included in the i18n framework.  
We use [@sapphire/plugin-i18next](https://github.com/sapphiredev/plugins/tree/main/packages/i18next) for translations; language files live in `apps/discord/src/languages`. Only add or edit the `en-US` strings: other locales are managed through [Crowdin](https://crowdin.com/project/wildbeast).

```ts
// ✗ bad
interaction.reply(`Hi there ${user.name}!`)
```

```ts
// ✓ good
interaction.reply(
  (await resolveKey(interaction, 'commands/greet:hello', {
    name: user.name,
  })) as string,
)
```

### Database operations

We use [Drizzle ORM](https://orm.drizzle.team/) for database access, wrapped in the `@thesharks/drizzle` workspace package.  
Do not create your own database connection. The runtime opens the only one, and commands, listeners, and tasks reach the database through the services on `this.container.app`. Queries live in the repositories under `apps/discord/src/adapters`, behind the interfaces those services use.
Schema changes belong in `@thesharks/drizzle`, alongside a generated migration, in the same pull request as the feature that needs them. See [Changing the schema](https://wildbeast.guide/development/database/#changing-the-schema).

## Commands

### File layout

Every command is one file in `apps/discord/src/commands`, named after the command. A command with subcommands is still one file: each subcommand is a method on the class.
Code that a command shares with its buttons or other component handlers goes in `apps/discord/src/integrations/<command>.mts`. Don't create a folder per command.

### Inheritance

All commands must extend a base class (`AppCommand` or `AppSubcommand` from `apps/discord/src/structures`) and be exported as a class, so the framework can construct them.

```ts
// ✗ bad
export default new AppCommand({
  // ...
})
```

```ts
// ✓ good
export class GreetCommand extends AppCommand {
  // ...
}
```

The base class owns Sapphire's entry points. It admits, traces, and gates every run, and then calls the method you implement:

| Piece | Extend | Implement | Don't define |
| --- | --- | --- | --- |
| Command | `AppCommand` | `chatInput`, and `autocomplete` if needed | `chatInputRun`, `autocompleteRun` |
| Command with subcommands | `AppSubcommand` | one method per subcommand, and `autocomplete` if needed | `chatInputRun`, `autocompleteRun` |
| Scheduled task | `AppScheduledTask` | `execute` | `run` |
| Button or select menu handler | `GatedCommandInteractionHandler` | `parse` and `execute` | `run` |

Every command and scheduled task also needs a runtime gate, `features.commands.<name>` or `features.tasks.<name>`, in `apps/discord/src/features/registry.mts`. The structure test fails when a gate is missing or when a command or task defines one of Sapphire's entry points itself.
[Writing pieces](https://wildbeast.guide/development/pieces/) has the details.
