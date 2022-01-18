---
description: Nest multiple separate commands under one base command
---

# Subcommands

![](<../../../.gitbook/assets/afbeelding (4).png>)

Subcommands are a great way to nest seperate commands under one base command, each subcommand is their own seperate command and can be called as such.

## In practise

{% hint style="info" %}
We're continuing off the example from the [Slash commands](./) page
{% endhint %}

```typescript
import { Interaction } from 'detritus-client'
import { BaseSlashCommand, BaseCommandOption } from '../base'

export default class PingCommand extends BaseSlashCommand {
  constructor () {
    super({
      name: 'ping',
      // With subcommands, the description doesn't matter,
      // since it doesn't get shown to end users.
      description: '',
      options: [
        new PongCommand()
      ]
    })
  }
  // The base command should not have a run(), it never gets called
}

export class PongCommand extends BaseCommandOption {
  constructor () {
    super({
      name: 'pong'
      description: 'Pong!'
    })
  }
  
  async run (context: Interaction.InteractionContext): Promise<void> {
    await context.editOrRespond(context, 'Pong!')
  }
}
```

