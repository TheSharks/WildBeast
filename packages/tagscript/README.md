<div align="center">

# TagScript

*Scripting for the wild ones.*

<p>
  <a href="https://www.npmjs.com/package/@thesharks/tagscript">
    <img src="https://img.shields.io/npm/v/@thesharks/tagscript.svg?style=flat-square" alt="NPM Version" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/npm/l/@thesharks/tagscript.svg?style=flat-square" alt="License" />
  </a>
  <a href="https://codecov.io/gh/thesharks/tagscript">
    <img alt="Codecov" src="https://img.shields.io/codecov/c/github/thesharks/tagscript?style=flat-square" alt="Codecov" />
  </a>
</p>
</div>

---

TagScript is a templating engine for chatbots that need flexible message generation. You can render messages with dynamic content, conditional logic, variables, and more.

Inspired by [JagTag-JS](https://github.com/TheSharks/JagTag-JS/), TagScript is WildBeast's modern, extensible, and secure successor.

## Install TagScript

```bash
npm install @thesharks/tagscript
```

## Basic usage

```ts
import { render } from '@thesharks/tagscript'

const result = await render('{upper:hello world}')
console.log(result.output) // HELLO WORLD
```

## Use a custom registry

```ts
import { render, createDefaultRegistry } from '@thesharks/tagscript'

const registry = createDefaultRegistry()
const result = await render('{upper:hello}', { registry })
console.log(result.output) // HELLO
```

## Create custom tags

```ts
import { render, createRegistry } from '@thesharks/tagscript'
import type { TagHandler } from '@thesharks/tagscript'

const greetHandler: TagHandler = (_ctx, args) => `Hello, ${args[0]}!`

const registry = createRegistry(
  { greet: greetHandler },
  {} // lazy tags
)

const result = await render('{greet:world}', { registry })
console.log(result.output) // Hello, world!
```

## Use variables

```ts
const result = await render('{get:name}', {
  variables: { name: 'Alice' },
})
console.log(result.output) // Alice
```

## JagTag-JS compatibility

TagScript syntax is mostly compatible with [JagTag-JS](https://github.com/TheSharks/JagTag-JS), with some improvements. Use TagScript's native syntax where possible for better performance and consistency.

TagScript maintains compatibility modes for some tags to help with migration:

```ts
import { render } from '@thesharks/tagscript'

const regexResult = await render(
  String.raw`{replaceregex:\d+|with:X|in:I have 5 cats and 23 shirts}`
)
console.log(regexResult.output) // I have X cats and X shirts

const ifResult = await render('{if:5|>|3|Yes|No}')
console.log(ifResult.output) // Yes

const mathResult = await render('{math:hello world|-| world}')
console.log(mathResult.output) // hello
```

## Configuration options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'strict' \| 'ignore'` | `'ignore'` | How to handle unknown tags. |
| `registry` | `TagRegistry` | `defaultRegistry` | Tag registry to use. |
| `variables` | `Record<string, string> \| Map<string, string>` | `{}` | Variables available to tags. |
| `args` | `string[]` | `undefined` | Arguments available through `{arg}` and `{args}`. |
| `discord` | `DiscordContext` | `undefined` | Discord-specific context for Discord tags. |
| `tagStore` | `TagStore` | `undefined` | Storage for lazy-loaded tags. |
| `enableJs` | `boolean` | `false` | Enable JavaScript execution. |
| `sandbox` | `Sandbox` | `undefined` | Sandbox for JavaScript execution. |
| `enableFetch` | `boolean` | `false` | Enable fetch tag. |
| `fetchOptions` | `RequestInit` | `undefined` | Options to pass to fetch. |
| `fetchAllowedHosts` | `string[]` | `undefined` | Hostnames the fetch tag may request (exact, case-insensitive). When set, every other host is rejected. See [Fetch safety](#fetch-safety). |
| `maxIterations` | `number` | `100` | Maximum render passes. Rendering throws if the output still changes after this many passes. |
| `inertHandlerOutput` | `string[]` | `['fetch', 'js', 'javascript']` | Tags whose output renders as literal text instead of being re-executed as TagScript. |
| `maxOutputLength` | `number` | `100000` | Maximum output length. |
| `maxDepth` | `number` | `100` | Maximum nested tag depth. |
| `maxFetchRequests` | `number` | `3` | Maximum fetch requests per render. |
| `regexPatternLength` | `number` | `1000` | Maximum regex pattern length. |
| `maxRegexInputLength` | `number` | `10000` | Maximum input length for regex operations. |

## Built-in tags

### String manipulation

| Tag | Description |
|-----|-------------|
| `{upper:text}` | Convert to uppercase. |
| `{lower:text}` | Convert to lowercase. |
| `{length:text}` | Get string length. |
| `{replace:text\|search\|replacement}` | Replace text. |
| `{replaceregex:text\|pattern\|replacement}` | Replace using regex. Supports `/pattern/flags` syntax. |
| `{replaceregex:pattern\|with:replacement\|in:text}` | JagTag-compatible syntax for regex replacement. |
| `{reverse:text}` | Reverse string. Grapheme-aware. |
| `{url:text}` | URL encode string. |
| `{substring:text\|start\|end}` | Extract substring. |
| `{oneline:text}` | Replace newlines with spaces. |
| `{hash:text}` | Java-style hashCode of string (matches JagTag). |

### Math

| Tag | Description |
|-----|-------------|
| `{math:a\|op\|b\|op\|c...}` | JagTag-compatible math operations. Supports `+`, `-`, `*`, `/`, `^`, `%`. |
| `{abs:value}` | Absolute value. |
| `{sin:value}` | Sine. |
| `{cos:value}` | Cosine. |
| `{tan:value}` | Tangent. |
| `{sqrt:value}` | Square root. |
| `{pi}` | Pi constant. |
| `{e}` | Euler's number. |
| `{add:a\|b}` | Addition. |
| `{subtract:a\|b}` | Subtraction. |
| `{multiply:a\|b}` | Multiplication. |
| `{divide:a\|b}` | Division. |
| `{pow:a\|b}` | Power (a^b). |
| `{mod:a\|b}` | Modulo. |
| `{choose:a\|b\|c}` | Random choice from pipe-separated values. |
| `{range:start\|end\|step}` | Generate number range. Maximum 2000 values. |
| `{random:min\|max}` | Random integer between min and max, inclusive. |
| `{ceil:value}` | Ceiling. |
| `{floor:value}` | Floor. |
| `{round:value}` | Round to nearest integer. |

### Time

| Tag | Description |
|-----|-------------|
| `{now}` | Current timestamp. |
| `{time}` | Formatted time. |

### Variables

| Tag | Description |
|-----|-------------|
| `{set:name\|value}` | Set variable. |
| `{get:name}` | Get variable. |
| `{delete:name}` | Delete variable. |

### Arguments

| Tag | Description |
|-----|-------------|
| `{arg:index}` | Get argument at index. |
| `{args}` | Get all arguments. |
| `{argslen}` | Get argument count. |

### Control flow

| Tag | Description |
|-----|-------------|
| `{if:a\|operator\|b\|then\|else}` | Conditional. Operators: `=`, `!=`, `>`, `<`, `>=`, `<=`, `~` (fuzzy match), `?` (regex match). |
| `{note:text}` | Comment. Ignored in output. |
| `{ignore:text}` | Ignore errors in text. |
| `{eval:expression}` | Evaluate expression. |

### Discord

| Tag | Description |
|-----|-------------|
| `{userid}` | User ID. |
| `{usertag}` | User tag. |
| `{mention}` | Mention user. |
| `{channelid}` | Channel ID. |
| `{server}` | Server name. |
| `{serverid}` | Server ID. |
| `{avatar}` | User avatar URL. |

### JavaScript

| Tag | Description |
|-----|-------------|
| `{js:code}` | Execute JavaScript. Requires `enableJs: true` and `sandbox`. |
| `{javascript:code}` | Alias for `{js}`. |

### Miscellaneous

| Tag | Description |
|-----|-------------|
| `{uuid}` | Generate random UUID v4. |

### Network

| Tag | Description |
|-----|-------------|
| `{fetch:url\|method}` | Fetch content from URL. Requires `enableFetch: true`. |

### Fetch safety

The fetch tag can reach network resources, so treat it as attacker-controllable when templates come from untrusted users. TagScript applies several safeguards:

- Only `http:` and `https:` URLs are allowed. Other schemes (`file:`, `ftp:`, ...) are rejected.
- Requests to loopback, private, link-local and cloud-metadata IP literals are blocked, including `localhost`/`*.localhost` and IPv4-mapped IPv6 forms such as `::ffff:127.0.0.1`.
- Responses are streamed and aborted once they exceed `maxOutputLength`, so a large remote body can't exhaust memory.
- Each request carries a 10-second `AbortSignal.timeout` unless your `fetchOptions` supplies its own signal.
- Fetched output is marked inert (see `inertHandlerOutput`) so remote bodies can't inject executable tags.

The IP checks only cover literal addresses in the URL. A hostname that resolves to a private address via DNS (DNS rebinding) is **not** blocked, because pinning the resolved address is out of scope. For untrusted templates, set `fetchAllowedHosts` to an explicit allowlist — this is the recommended safeguard:

```ts
await render('{fetch:https://api.example.com/data}', {
  enableFetch: true,
  fetchAllowedHosts: ['api.example.com'],
})
```

## Normal tags vs lazy tags

TagScript supports two types of tags: normal tags and lazy tags.

**Normal tags** receive arguments as pre-rendered strings. They're ideal for simple transformations like string manipulation or math operations.

**Lazy tags** receive raw AST segments (unrendered arguments). The handler decides when and whether to render each argument. This allows for complex behavior like conditional rendering.

| Aspect | Normal tags | Lazy tags |
|--------|-------------|-----------|
| Arguments type | `string[]` (rendered) | `Segment[]` (AST nodes) |
| When arguments render | Before handler runs | Handler decides |
| Complexity | Simple string transforms | More control over flow |
| Best for | String and math transforms | Control flow, conditionals |
| Examples | `{upper}`, `{replace}`, `{add}` | `{if}`, `{note}`, `{fetch}` |

## Handle errors

By default, TagScript runs in `'ignore'` mode where unknown tags are left as-is. Use `mode: 'strict'` to throw errors on unknown tags.

```ts
// Default behavior: leave unknown tags untouched
const result1 = await render('{unknown:tag}')
console.log(result1.output) // {unknown:tag}

// Strict mode: throw error
await render('{unknown:tag}', { mode: 'strict' })
// throws RenderError: Unknown tag: unknown
```

## Execute JavaScript

To enable JavaScript execution within TagScript templates, set `enableJs` to `true` and provide a `sandbox` for secure execution.

Use `isolated-vm` or a similar library to create a secure sandbox environment:

```ts
import { render } from '@thesharks/tagscript'
import ivm from 'isolated-vm'

const isolate = new ivm.Isolate({ memoryLimit: 128 })
const context = await isolate.createContext()
const sandbox = {
  execute: async (code: string) => {
    const script = await isolate.compileScript(code)
    const result = await script.run(context)
    return result
  },
}

const result = await render('{js:2 + 2}', { enableJs: true, sandbox })
console.log(result.output) // 4
```

## Avoid string interpolation issues

V8 interprets strings such as `\d` as escape sequences during parsing. This can cause issues when using regex patterns directly in templates.

Call the parser with raw strings to avoid this problem:

```ts
import { render } from '@thesharks/tagscript'

// Incorrect: V8 turns \d into d, so the pattern matches the letter d
const wrongTemplate = `{replaceregex:I have 5 cats and 23 shirts|\d+|X}`
const wrongResult = await render(wrongTemplate)
console.log(wrongResult.output) // "I have 5 cats anX 23 shirts"

// Correct: use String.raw
const template = String.raw`{replaceregex:I have 5 cats and 23 shirts|\d+|X}`
const result = await render(template)
console.log(result.output) // I have X cats and X shirts
```

## Recursive rendering

TagScript re-renders its output until it stops changing, so tag output containing `{...}` executes on the next pass. This is what makes stored tags and variables composable:

```ts
const result = await render('{get:greeting}', {
  variables: { greeting: '{upper:hello}' },
})
console.log(result.output) // HELLO
```

Three safeguards bound this recursion:

- `maxIterations` caps the number of render passes. If the output still changes when the cap is reached, rendering throws a `RenderError` instead of returning partially rendered output.
- `maxDepth` caps nesting depth, including inside lazy tags like `{if}` and `{eval}`.
- `inertHandlerOutput` lists tags whose output is never re-executed. It defaults to `['fetch', 'js', 'javascript']` so remote responses and sandbox results render as literal text. Pass your own list to change this — including an empty array to re-execute everything.

## Regular expression safety

TagScript includes safeguards to prevent ReDoS (Regular Expression Denial of Service) attacks when using regex-based tags. TagScript uses [recheck](https://www.npmjs.com/package/recheck) to analyze regex patterns for potential vulnerabilities before execution.

No check is perfect. Some false positives or negatives can occur. Use caution when relying on these checks for security-critical applications.

For complete safety, use [RE2](https://github.com/uhop/node-re2). RE2 only works in Node.js environments, but it guarantees linear-time regex execution. See the [RE2 integration example](./examples/re2.ts) for implementation details.

## License

MIT
