---
description: Add commands to context menus shown on right-click for users and messages
---

# Context menu actions

There are 2 types of context menu actions, depending on what the end user is opening the context menu on.

{% tabs %}
{% tab title="User context" %}
![](<../../.gitbook/assets/afbeelding (1).png>)

```typescript
import { Interaction } from 'detritus-client'
import { MessageFlags } from 'detritus-client/lib/constants'

import { BaseContextMenuUserCommand, ContextMenuUserArgs } from '../../base'

export default class InformationCommand extends BaseContextMenuUserCommand {
  name = 'Avatar'

  async run (context: Interaction.InteractionContext, args: ContextMenuUserArgs): Promise<void> {
    await context.editOrRespond({
      embed: {
        description: `${args.user.mention}'s avatar`,
        image: {
          url: `${args.user.avatarUrl}?size=512`
        }
      },
      flags: MessageFlags.EPHEMERAL
    })
  }
}

```
{% endtab %}

{% tab title="Message context" %}
![](../../.gitbook/assets/afbeelding.png)

```typescript
import { Interaction } from 'detritus-client'
import { MessageFlags } from 'detritus-client/lib/constants'

import { BaseContextMenuMessageCommand, ContextMenuMessageArgs } from '../../base'

export default class InformationCommand extends BaseContextMenuMessageCommand {
  name = 'Message ID'

  async run (context: Interaction.InteractionContext, args: ContextMenuMessageArgs): Promise<void> {
    await context.editOrRespond({
      embed: {
        description: `Message ID: ${args.message.id}`
      },
      flags: MessageFlags.EPHEMERAL
    })
  }
}

```
{% endtab %}
{% endtabs %}
