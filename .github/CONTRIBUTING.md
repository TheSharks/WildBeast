Thank you for taking the time to contribute to the development of WildBeast!

Follow these rules when making contributions to this repository.

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

Run `pnpm test` in the project root to run the unit tests. Integration tests (`pnpm test:integration`) require Docker and are also run in CI.

## Code practices

### Translations

All user-facing text, meaning text that gets sent to Discord and is displayed to end users, needs to be included in the i18n framework.  
We use [@sapphire/plugin-i18next](https://github.com/sapphiredev/plugins/tree/main/packages/i18next) for translations; language files live in `apps/discord/src/languages`.

```ts
// ✗ bad
interaction.reply(`Hi there ${user.name}!`);
```

```ts
// ✓ good
interaction.reply(await resolveKey(interaction, "user/greeting:hello", { name: user.name }));
```

### Database operations

We use [Drizzle ORM](https://orm.drizzle.team/) for database access, wrapped in the `@thesharks/drizzle` workspace package.  
When something requires database access, do not create your own database connection; use the client and schema exported from `@thesharks/drizzle`. Schema changes belong in that package, alongside a migration.

## Commands

### Sorting

Commands are sorted first by type, then by base command if the command has subcommands, and then by subcommand.
If your command doesn't have subcommands or your command is a context menu action, placing the entire command in 1 file is fine.

### Inheritance

All commands must extend a base class (`AppCommand` or `AppSubcommand` from `apps/discord/src/structures`) and be exported as a class, so the framework can construct them.

```ts
// ✗ bad
export default new AppCommand({
  // ...
});
```

```ts
// ✓ good
export class GreetCommand extends AppCommand {
  // ...
}
```
