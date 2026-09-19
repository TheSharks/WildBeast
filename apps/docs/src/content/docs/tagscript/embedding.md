---
title: Embedding TagScript
description: Running TagScript in your own code, from rendering to custom tags and safety.
sidebar:
  order: 4
---

TagScript is published as
[`@thesharks/tagscript`](https://www.npmjs.com/package/@thesharks/tagscript) and
requires Node.js 22 or later with ECMAScript modules (ESM). This guide covers
rendering, custom handlers, and execution limits. The
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

A registry maps tag names to handler functions. Build one with `createRegistry`
and pass it to `render`:

```ts
import { render, createRegistry } from '@thesharks/tagscript'
import type { TagHandler } from '@thesharks/tagscript'

const greet: TagHandler = (_ctx, args) => `Hello, ${args[0]}!`
const registry = createRegistry({ greet })

const result = await render('{greet:world}', { registry })
console.log(result.output) // Hello, world!
```

A normal handler receives its arguments as rendered strings, as in the
example above. A lazy handler receives unrendered argument nodes and chooses
which ones to render. This is how control-flow
tags like `{if}` avoid evaluating the branch they don't take. Pass lazy
handlers as the second argument to `createRegistry`.

## The `{fetch}`, `{js}`, and regex tags

Both are disabled by default because they reach outside the template. Turn them
on only when you trust the source of the template, or with the guardrails
below.

`{fetch}` needs `enableFetch: true`. It already rejects non-HTTP schemes,
blocks requests to private and loopback IP literals, follows redirects
manually so every hop is validated against the same rules, streams and aborts
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

`{js}` needs both `enableJs: true` and a `sandbox` you provide, since TagScript
does not execute code itself. Use
[`isolated-vm`](https://github.com/laverdet/isolated-vm) or similar so scripts
run with a memory limit, an execution timeout, and no access to the host; the
README has a worked example.

The regex tags, `{replaceregex}` and the `?` operator of `{if}`, also need
something from you: a `regexSafety` checker. A crafted pattern can keep a CPU
busy for minutes
([ReDoS](https://en.wikipedia.org/wiki/ReDoS)), so TagScript only runs a
user-supplied pattern after a checker confirms it's safe. The package ships
one built on [recheck](https://www.npmjs.com/package/recheck):

```sh
npm install recheck
```

```ts
import { render } from '@thesharks/tagscript'
import { recheckSafety } from '@thesharks/tagscript/recheck'

const { output } = await render('{replaceregex:hello world|o+|0}', {
  regexSafety: recheckSafety,
})
// output === 'hell0 w0rld'
```

`recheck` is an optional peer dependency, and only the
`@thesharks/tagscript/recheck` entry point imports it. If your templates
don't use regex, skip it: it's a large analyzer that also downloads
platform binaries. Without a checker every other tag works, and a regex tag
fails with an error that names the missing option.

`createRecheckSafety({ timeout })` changes the 500 ms analysis budget. To use
another analyzer, pass any object with an
`isSafe(pattern, flags): Promise<boolean>` method. Resolve `true` only when
the pattern is known to be safe; a checker that throws counts as unsafe.

## Limits and safety

Tag output is literal. Whatever a handler returns (an argument, a variable, a
fetched body, a sandbox result) goes into the output as plain text and is
never executed as TagScript. The only ways rendered text runs as a template
are `{eval}` and stored tags from a `tagStore`, and each of those expansions
counts against `maxIterations`. Values passed in `args`, `variables`, or
`discord` context therefore remain text unless a template explicitly
evaluates them. Treat `{eval}` input and stored templates as executable
TagScript.

Every bound from the [reference](/tagscript/tags/#limits) is an option:
`maxIterations`, `maxDepth`, `maxOutputLength`, `maxFetchRequests`,
`regexPatternLength`, `maxRegexInputLength`, and `maxRegexOperations`.

Regex-based tags only run patterns that your
[`regexSafety` checker](#the-fetch-js-and-regex-tags) positively verifies as
safe. This screening does not replace execution limits. Review the limits for your workload and tighten
them when accepting templates from users.
