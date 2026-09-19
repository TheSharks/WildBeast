# Documentation guide

Use these conventions for the Starlight site and Markdown in `docs/`.

## Voice and writing style

Write as a knowledgeable teammate helping someone who knows Discord bots but
is new to WildBeast. Keep the voice friendly, direct, and matter-of-fact across
guides and reference pages.

- Address the reader as "you." Use active voice and present tense for current
  behavior: "The worker opens the database" instead of "The database will be
  opened." Use natural contractions such as "don't" and "it's."
- Lead with the purpose or outcome, then explain what the reader needs to do
  and why. Keep each paragraph focused on one idea. Include enough context to
  make instructions understandable without repeating the introduction.
- Prefer familiar words and concrete descriptions. Explain technical terms on
  first use when they're specific to WildBeast or its operations. Assume the
  reader knows Discord bots; don't re-explain guilds, the Gateway, or other
  Discord basics. A little conversational flavor is welcome when it helps
  the text flow. Avoid marketing claims, grand terminology, and
  anthropomorphizing the software.
- Be precise about requirements and uncertainty. Use "must" for a requirement,
  "we recommend" for advice, and "can" for an option. State relevant conditions
  and limitations instead of making sweeping guarantees.
- Use standard US English, the serial comma, and sentence case headings.
  Write "for example" and "that is" rather than "e.g." and "i.e."
- Keep terminology consistent with neighboring pages: "WildBeast," "shard
  worker," "cluster manager," "entitlement mirror," and "operator command."
  Use "limit" or "cap" for numerical ceilings; don't invent synonyms for
  established concepts just to vary the wording.
- Use realistic examples, such as a `hello` tag, with names and values that
  remain consistent throughout the page. Mark placeholders and optional steps
  clearly. Put prerequisites before the instructions that depend on them.
- Use prose for explanations, numbered steps for procedures, and tables or
  bullets for information readers need to compare or scan. Include related
  links where they help; overview paragraphs and "Next steps" sections aren't
  mandatory when they add no useful information.
- When editing, read the surrounding text and keep the same audience, level of
  detail, and terminology. Fix local inconsistencies without rewriting
  unrelated sections merely to impose a different voice.

## Source accuracy and site conventions

Check the implementation before describing behavior, and use the site's
formatting and link conventions.

- Check names, defaults, and behavior against the current source. Configuration
  lives in `apps/discord/src/env.mts` and `runtime/config.mts`; metric
  definitions live beside their emitters.
- Site pages need frontmatter with `title`, `description`, and `sidebar.order`.
  Wrap prose around 80 characters; long links, tables, and code are exempt.
- Use code formatting for filenames, commands, environment variables, metric
  names, flag keys, and API elements. Use bold for UI labels.
- Use Starlight callouts (`:::note`, `:::tip`, `:::caution`, `:::danger`).
  GitHub-style alert blocks do not render as callouts on the site.
- Link between site pages with site-absolute paths and trailing slashes, such
  as `/self-hosting/configuration/#redis`. Use descriptive link text.
- When changing headings or moving pages, update incoming links and anchors.
  The sidebar is split into topics (WildBeast, TagScript, Analytics) with
  `starlight-sidebar-topics` in `astro.config.mjs`. Every page must belong to
  a topic: the WildBeast and Analytics topics autogenerate from their
  directories, while TagScript pages are listed by slug, so add new ones
  there.
- Keep examples and operator references consistent with the implementation.
  When a metric changes, update affected dashboard queries, alerts, and docs.
- Preserve useful upgrade instructions when removing historical material.
- Check changed links, search for stale references, and run
  `pnpm --filter @thesharks/docs build` before finishing site changes.
