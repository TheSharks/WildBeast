---
title: TagScript internals
description: How the interpreter works, and how to add a tag.
sidebar:
  order: 8
---

How `@thesharks/tagscript` works under the hood, for anyone changing the
language or adding tags. For using the package, see
[embedding](/tagscript/embedding/); for the language itself, the
[overview](/tagscript/overview/).

## Package layout

Everything lives in `packages/tagscript/src`:

| Path | What it is |
| --- | --- |
| `parser.ts` | Template text to AST, single pass. |
| `runtime/renderer.ts` | The renderer: walks the AST, calls handlers. |
| `runtime/registry.ts`, `default-registry.ts` | Tag name to handler mapping. |
| `runtime/limits.ts` | Default limits and their validation. |
| `runtime/regex-safety.ts` | ReDoS analysis and the per-render regex budget. |
| `runtime/entry.ts` | Turns public `RenderOptions` into a `RenderContext`. |
| `tags/` | The built-in handlers, one file per category. |
| `index.ts`, `web.ts` | The two entry points (Node and browser). |
| `sandbox/` | The interface a `{js}` sandbox must implement. |

## Parsing

`parse` makes one pass over the input and returns a tree of text and tag
nodes. The properties that matter:

- Escapes are resolved at parse time: `\{` becomes a literal `{` inside
  a text node; the renderer never sees escape sequences. Because rendered
  output is never parsed again, escaped text can't turn back into an
  executable tag later.
- Malformed syntax is text, not an error: an unclosed `{`, an empty tag
  name (`{}`), or a stray `}` all fall back to literal text. Two guards
  bound pathological input instead of failing on normal input: a hard
  recursion limit of 1000, and a work budget proportional to input length
  that rejects inputs crafted to force repeated rescanning. Tag parses are
  memoized by position, so nested unclosed tags don't multiply work.
- Arguments are sub-segments: `{if:a|b}` parses into a tag node whose
  `args` are each their own segment, which may contain nested tags.
- Every node carries a span (start and end offsets into the source),
  which the renderer uses to reproduce unknown tags exactly as written and
  the docs playground uses for its AST view.

## Rendering

`render` makes a single top-down pass over the parse tree. Whatever a
handler returns is literal text: it goes into the output verbatim and is
never parsed as TagScript again. This is the interpreter's trust boundary.
Arguments, variables, Discord context, fetched bodies, and sandbox results
are all data, so a caller-supplied argument containing `{js:...}` renders
as those nine characters instead of executing.

Each tag node resolves in this order:

1. Lazy tags (`if`, `eval`, `ignore`, `note`, and `fetch` in the Node
   entry) receive their arguments as unrendered AST segments and decide
   what to render. That's how `{if}` skips the branch it doesn't take.
2. Normal tags get their arguments rendered first (depth-first, left to
   right, so side effects like `{set}` land in a deterministic order),
   then the handler runs on plain strings.
3. No handler, but a variable with that name exists: the variable's
   value is the output. This is why `{score}` reads a variable directly.
4. No handler or variable, but a `tagStore` returns contents for the
   name: the contents are a stored template, and they execute as one.
5. Otherwise the tag is unknown: in `ignore` mode it renders as its
   literal source text (recovered via the node's span); in `strict` mode
   the render throws.

### Expansions

Two places deliberately cross back from literal text to executable
template: `{eval}`, which renders its argument and then executes the
result, and stored tags from a `tagStore`, whose contents are template
source by definition. Both route through one renderer function
(`renderExpansion`), and each crossing counts against `maxIterations`
(default 100), so mutually recursive stored tags or self-evaluating
variables run out of budget instead of looping.

`maxDepth` is enforced on every tag entry, and `maxOutputLength` while
output accumulates (after each handler result and each concatenation), so
a template can't build a huge intermediate string before the final check
would catch it.

## Registries and entry points

A registry is two maps, normal and lazy handlers, built with
`createRegistry`. There are two entry points with different defaults:

- `@thesharks/tagscript` (`index.ts`): the full registry, including
  `{fetch}` (as a lazy handler, so its URL argument renders before the
  request goes out).
- `@thesharks/tagscript/web` (`web.ts`): the browser-safe registry,
  everything except `{fetch}`. This is what the documentation's live
  playground imports, straight from source via a Vite alias.

Embedders can pass their own registry per render, so the defaults are just
that.

## Adding a built-in tag

1. Write the handler in the matching `tags/` file (or a new one). A normal
   handler is `(ctx, args, limits) => string | Promise<string>`; use a lazy
   handler only when you need control over whether arguments render.
2. Register it in `default-registry.ts`. That covers both entry points;
   only Node-specific tags (like `{fetch}`) are added separately in
   `index.ts`.
3. Add tests in `packages/tagscript/test`. The public API tests assert the
   exported surface, so new exports need updating there too.
4. Document it: the [tag reference](/tagscript/tags/) and the package
   README both list every tag, and this documentation is the contract.

Handlers must not throw on bad input; the convention is returning an empty
string or an `Error: ...` message, matching JagTag behavior. Reserve
exceptions for limit violations.

## Next steps

- [Embedding](/tagscript/embedding/) documents the public API these
  internals implement.
- [Testing](/development/testing/) covers how to run the suite.
