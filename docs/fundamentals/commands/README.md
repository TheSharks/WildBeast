---
description: Write your own custom commands
---

# Commands

{% hint style="danger" %}
Custom commands is an advanced feature and requires knowledge of programming.

**Support for doing this will not be provided in addition to what is listed on these pages.**
{% endhint %}

{% hint style="info" %}
Under the hood, WildBeast's command system is an extension of the system from [Detritus](https://github.com/detritusjs).

We won't go into some of the more advanced ways to control command flow that's included with Detritus' system, such as `onBeforeRun`, built-in ratelimiting, and permission checks.

For more info on this, please see the [Detritus Documentation](https://detritusjs.com/classes/interaction\_command.interactioncommand), and the [Detritus Examples](https://github.com/detritusjs/client/tree/master/examples/ts/example-bots/commands/interactions/commands) instead.
{% endhint %}

There are 3 types of commands, slash commands and 2 types of context menu commands. Documentation for each type is provided below.

{% content-ref url="slash-commands/" %}
[slash-commands](slash-commands/)
{% endcontent-ref %}

{% content-ref url="context-menu-actions.md" %}
[context-menu-actions.md](context-menu-actions.md)
{% endcontent-ref %}

