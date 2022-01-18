---
description: Slash commands are the primary way to interact with bots
---

# Slash commands

![](<../../../.gitbook/assets/afbeelding (12).png>)

## Creating commands

{% hint style="info" %}
**Reminder:** Check the [Detritus Documentation](https://detritusjs.com/classes/interaction\_command.interactioncommand) for more advanced settings.
{% endhint %}

A finished command looks like this:

```typescript
import { Interaction } from 'detritus-client'
import { BaseSlashCommand } from '../base'

export default class PingCommand extends BaseSlashCommand {
  constructor () {
    super({
      description: 'Ping',
      name: 'ping'
    })
  }

  async run (context: Interaction.InteractionContext): Promise<void> {
    await context.editOrRespond(context, 'Pong!')
  }
}

```

There are a few things to note with regard to how commands are constructed:

* All commands are new classes that extend a base class, in this example the command is a plain slash command.
* The resulting command is exported as the default export.
* The constructor with a super call is used to set properties of the class instead of directly assigning them, this avoids incompatibilities with Detritus.

## In practice

When restarting WildBeast, your newly created command will automatically be registered as a global command, and will be available within a few hours.

Rather want a guild-based command instead of a global one? Add guild IDs to the constructor of your command:

```typescript
constructor () {
  super({
    description: 'Ping',
    name: 'ping',
    guildIds: ['110462143152803840']
  })
}
```

## What's next?

There are more things you can do with commands, like adding options, creating subcommands, and adding buttons and select menus.

{% content-ref url="subcommands.md" %}
[subcommands.md](subcommands.md)
{% endcontent-ref %}

{% content-ref url="options.md" %}
[options.md](options.md)
{% endcontent-ref %}

{% content-ref url="buttons.md" %}
[buttons.md](buttons.md)
{% endcontent-ref %}

