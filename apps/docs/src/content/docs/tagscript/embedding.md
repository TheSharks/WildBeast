---
title: Embedding TagScript
description: Running TagScript in your own code, from rendering to custom tags and safety.
sidebar:
  order: 4
---

TagScript is published as [`@thesharks/tagscript`](https://www.npmjs.com/package/@thesharks/tagscript)
and runs anywhere Node does. This page is the tour; the
[package README](https://github.com/TheSharks/WildBeast/tree/master/packages/tagscript)
has the full option-by-option reference.

```bash
npm install @thesharks/tagscript
```

## Rendering

`render` takes the template and an options object and returns the output:

```ts
import { render } from '@thesharks/tagscript'

const result = await render('{upper:hello}')
console.log(result.output) // HELLO
```

Pass `variables` to seed values, `args` for positional arguments, and
`discord` to supply the context the [Discord tags](/tagscript/tags/#discord)
read from. Set `mode: 'strict'` to throw on an unknown tag instead of leaving
it untouched.

## Custom tags

Tags are registered in a **registry**. Build your own with `createRegistry` and
pass it to `render`:

```ts
import { render, createRegistry } from '@thesharks/tagscript'
import type { TagHandler } from '@thesharks/tagscript'

const greet: TagHandler = (_ctx, args) => `Hello, ${args[0]}!`
const registry = createRegistry({ greet })

const result = await render('{greet:world}', { registry })
console.log(result.output) // Hello, world!
```

A **normal tag** (above) receives its arguments already rendered as strings,
right for simple transforms. A **lazy tag** receives the unrendered argument
nodes and decides when, or whether, to render each one; that's how control-flow
tags like `{if}` avoid evaluating the branch they don't take. Pass lazy
handlers as the second argument to `createRegistry`.

## The `{fetch}` and `{js}` tags

Both are disabled by default because they reach outside the template. Turn them
on only when you trust the source of the template, or with the guardrails
below.

`{fetch}` needs `enableFetch: true`. It already rejects non-HTTP schemes,
blocks requests to private and loopback IP literals, streams and aborts
oversized responses, and times out after 10 seconds. One gap remains: a
hostname that resolves to a private address through DNS is not caught. For
untrusted templates, set `fetchAllowedHosts` to an explicit allowlist; this is
the recommended safeguard:

```ts
await render('{fetch:https://api.example.com/data}', {
  enableFetch: true,
  fetchAllowedHosts: ['api.example.com'],
})
```

`{js}` needs `enableJs: true` **and** a `sandbox` you provide, since TagScript
does not execute code itself. Use [`isolated-vm`](https://github.com/laverdet/isolated-vm)
or similar so scripts run with a memory limit and no access to the host; the
README has a worked example.

## Limits and safety

Every bound from the [reference](/tagscript/tags/#limits) is an option:
`maxIterations`, `maxDepth`, `maxOutputLength`, `maxFetchRequests`,
`regexPatternLength`, and `maxRegexInputLength`. `inertHandlerOutput` lists the
tags whose output is never re-rendered (default: `fetch`, `js`, `javascript`).

Regex-based tags are additionally screened for [ReDoS](https://en.wikipedia.org/wiki/ReDoS)
with [recheck](https://www.npmjs.com/package/recheck) before running. No static
check is perfect; for a hard guarantee, back the tags with
[RE2](https://github.com/uhop/node-re2), which runs every pattern in linear
time. The defaults are safe for trusted input; tighten them when templates
come from your users.
