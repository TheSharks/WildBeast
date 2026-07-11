export interface Limits {
  /**
   * Maximum number of template expansions per render. Each deliberate
   * re-execution of rendered text ({eval}, stored tags from a tagStore)
   * counts as one expansion.
   */
  maxIterations: number
  maxOutputLength: number
  maxDepth: number
  regexPatternLength: number
  maxRegexInputLength: number
  maxFetchRequests: number
  /** Maximum regex evaluations ({if} `?` operator, {replaceregex}) per render. */
  maxRegexOperations: number
}

export interface RenderResult {
  output: string
  attachment?: { data: Uint8Array; type: string }
}

export type RenderMode = 'strict' | 'ignore'

export interface DiscordUser {
  id: string
  tag: string
  mention: string
  /** Complete avatar URL. When set, {avatar} returns it verbatim. */
  avatarUrl?: string
  avatarBase?: string
  avatarFormat?: string
}

export interface DiscordContext {
  user?: DiscordUser
  channelId?: string
  serverId?: string
  server?: string
}

export interface TagStore {
  getTagContents: (tagName: string) => string | undefined
}

export interface RenderContext {
  mode: RenderMode
  options: RenderOptions
  registry?: TagRegistry
  variables?: Map<string, string>
  args?: string[]
  discord?: DiscordContext
  tagStore?: TagStore
  sandbox?: import('./sandbox/types.js').Sandbox
  fetchRequests: number
  /** Template expansions performed so far; bounded by limits.maxIterations. */
  expansions: number
  /** Regex evaluations performed so far; bounded by limits.maxRegexOperations. */
  regexOperations: number
  /** Attachment produced by a handler (e.g. a sandbox), surfaced on RenderResult. */
  attachment?: { data: Uint8Array; type: string }
}

export type TagHandler = (
  ctx: RenderContext,
  args: string[],
  limits: Limits,
) => Promise<string> | string

export type LazyTagHandler = (
  ctx: RenderContext,
  args: Segment[],
  limits: Limits,
  depth?: number,
) => Promise<string> | string

export interface TagRegistry {
  get: (name: string) => TagHandler | undefined
  isLazy?: (name: string) => boolean
  getLazy?: (name: string) => LazyTagHandler | undefined
}

export interface RenderOptions extends Partial<Limits> {
  mode?: RenderMode
  registry?: TagRegistry
  variables?: Record<string, string> | Map<string, string>
  args?: string[]
  discord?: DiscordContext
  tagStore?: TagStore
  enableJs?: boolean
  enableFetch?: boolean
  fetchOptions?: RequestInit
  /**
   * Hostnames the fetch tag is allowed to request (exact match,
   * case-insensitive). When provided, every other host is rejected — this is
   * the recommended safeguard for attacker-controllable templates. When
   * omitted, all hosts are allowed except loopback, private, link-local and
   * metadata IP literals plus `localhost` names. Every redirect hop is
   * revalidated against the same rules.
   */
  fetchAllowedHosts?: string[]
  sandbox?: import('./sandbox/types.js').Sandbox
}

export interface Span {
  start: number
  end: number
}

export type TextNode = { type: 'text'; value: string; span: Span }
export type TagNode = { type: 'tag'; name: string; args: Segment[]; span: Span }
export type Node = TextNode | TagNode

export type Segment = { nodes: Node[] }
export type Ast = Segment
