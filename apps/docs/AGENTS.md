# Documentation writing guide

This guide applies to every page under `apps/docs/src/content/docs/` and to
the Markdown files in `docs/`. Follow it whenever you write, edit, or review
documentation. Accuracy against the code in `apps/discord/src` and
`packages/` comes first; style comes second; both are required.

The style is adapted from the Gemini CLI `docs-writer` skill:
<https://raw.githubusercontent.com/google-gemini/gemini-cli/refs/heads/main/.gemini/skills/docs-writer/SKILL.md>.
Its standards carry over as written unless a rule below says otherwise;
the exceptions exist because this site is a Starlight site with its own
callout and link syntax, not a `/docs` folder rendered by GitHub.

## Voice and tone

Balance professionalism with a helpful, conversational tone. Write for
someone who knows Discord bots but not this codebase.

- Address the reader as "you." Use active voice and present tense ("the
  worker opens the database," not "the database will be opened").
- Keep the tone professional, friendly, and direct. Use contractions
  (don't, it's, you're). Avoid "please."
- Prefer simple vocabulary. Avoid jargon, slang, marketing language, idioms,
  and cultural references; the audience is global.
- Never anthropomorphize the software ("the reconciler thinks"). Say what it
  does.
- Distinguish requirements from recommendations: use "must" for
  requirements and "we recommend" for advice. Avoid "should."
- Refer to the project as "WildBeast," never "the WildBeast." Refer to
  Discord's product names as Discord spells them.

## Language and grammar

Precision keeps instructions unambiguous.

- Use standard US English and the serial comma. Place periods and commas
  inside quotation marks.
- Write "for example" and "that is," never "e.g." or "i.e."
- Use unambiguous dates ("September 5, 2026").
- Prefer specific verbs and short constructions: "lets you," not "allows
  you to."
- Use meaningful names in examples (a `hello` tag, a `booru` command),
  never placeholders like `foo`.
- Use "limit" or "cap" for a numerical ceiling (a tag limit of 50). Reserve
  "quota" for an administrative allocation, which this project doesn't
  have today.

## Formatting and syntax

Consistent formatting makes pages scannable and accessible.

- Every page starts with frontmatter (`title`, `description`, and
  `sidebar.order`) and an introductory paragraph that says what the page
  covers before the first heading.
- Every heading is followed by at least one overview paragraph before any
  list, table, sub-heading, or code block.
- Use sentence case for headings, titles, and bold text.
- Wrap prose at 80 characters. Long links, table rows, and code lines are
  exempt.
- Use numbered lists for sequential steps and bulleted lists otherwise.
  Keep list items parallel in structure.
- Use `code font` for filenames, paths, commands, environment variables,
  metric names, flag keys, and API elements. Use **bold** for UI elements.
  Focus on the task when describing interaction, not the control.
- Use semantic elements correctly: real headings, lists, and tables, never
  bold text standing in for a heading.
- Callouts: use Starlight asides (`:::note`, `:::tip`, `:::caution`,
  `:::danger`) instead of the GitHub `> [!NOTE]` alert syntax; this site
  doesn't render the latter.
- Use a `<details><summary>` block for supplementary or data-heavy content
  that isn't critical to the main flow, with a blank line after the
  `<summary>` line so the Markdown inside renders.
- Use tables for reference material (environment variables, metrics,
  schema columns) and prose for explanation.
- Give every image descriptive alt text and a lowercase, hyphenated
  filename under `src/assets/`.
- Don't add a table of contents; Starlight generates one.

## Links

Links must make sense out of context, such as when read by a screen reader.

- Use descriptive anchor text ("the metrics reference"), never "here" or
  "click here."
- Link to other docs pages with site-absolute paths and a trailing slash,
  matching the existing pages (`/self-hosting/configuration/#redis`). This
  replaces the upstream rule about relative `docs/` paths, because Starlight
  resolves routes, not files.
- When you rename a heading, search the docs for links to its old anchor
  and update them.
- Link to source files by path in code font rather than by GitHub URL, so
  the reference stays valid across branches.

## Structure

Pages follow the reader's journey from what to why to how.

- Open with the bottom line: what the page is about and what the reader
  gets from it.
- Use hierarchical headings that follow the task or the concept, not the
  code layout.
- Introduce a procedure with a complete sentence, start each step with an
  imperative verb, state conditions before instructions ("With
  `WILDBEAST_DEV_GUILD_ID` set, ..."), and give clear context for where
  the action takes place. Mark optional steps as "Optional:".
- Mark an experimental feature with a `:::note` right after the
  introduction, saying it's under active development.
- End reference and guide pages with a "Next steps" section that links to
  the pages a reader is likely to need next.

## Preparation

Documentation describes the code as it is, not as it was or as it's
planned. Before changing anything:

1. Clarify the request. Distinguish writing new content from editing
   existing content; if a request is ambiguous ("fix the docs"), ask what
   is wrong before rewriting.
2. Investigate the relevant source under `apps/discord/src` or
   `packages/` and confirm names, defaults, and behavior. Configuration
   comes from `apps/discord/src/env.mts` and `runtime/config.mts`; metric
   names from the contract in `packages/analytics/src/utils/metrics.ts`.
3. Audit the current version of the page you're changing.
4. Connect: find every page that references the behavior you're changing.
   The sidebar is generated from the directory layout in
   `astro.config.mjs`, so a new page only needs frontmatter.
5. Plan the change, and keep it to the scope you planned.

## Editing existing documentation

Reviews and updates carry extra duties beyond adding text.

- Gaps: look for content that no longer reflects the code, not only the
  lines the request names.
- Structure: apply the rules above to new sections; don't inherit an old
  section's shape when it breaks them.
- Headings: when you change one, update every link to it.
- Tone and clarity: rephrase passive, hedged, or awkward sentences while
  you're there.
- Consistency: use the same terms as the surrounding pages (shard worker,
  cluster manager, entitlement mirror, operator command).

## Verification and finalization

A change is done when it's accurate, consistent, and builds.

1. Confirm every statement against the implementation, including defaults
   and log messages you quote.
2. Re-read the changed text for formatting, correctness, wrapping, heading
   case, and flow.
3. Check every link leading to or from the modified pages, especially
   anchors you renamed.
4. Search the docs for stale terms you replaced (old module names, removed
   variables, renamed anchors).
5. Run `pnpm --filter @thesharks/docs build` from the repository root; it
   must complete without errors. There is no Markdown formatter in this
   repository, so wrapping and casing are checked by reading.
6. When you touched metric names, run `node scripts/check-metrics.mjs` from
   the repository root; the docs are part of the metrics contract.
