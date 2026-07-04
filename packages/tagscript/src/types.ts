export interface Limits {
  maxIterations: number
  maxOutputLength: number
  maxDepth: number
  regexPatternLength: number
  maxRegexInputLength: number
  maxFetchRequests: number
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
  /** Tags whose output is rendered as literal text instead of being re-executed on later passes. */
  inertTags?: Set<string>
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
  maxIterations?: number
  maxOutputLength?: number
  maxDepth?: number
  maxFetchRequests?: number
  variables?: Record<string, string> | Map<string, string>
  args?: string[]
  discord?: DiscordContext
  tagStore?: TagStore
  enableJs?: boolean
  enableFetch?: boolean
  /**
   * Tags whose output is treated as literal text instead of being re-executed
   * as TagScript on later render passes. Defaults to ['fetch', 'js', 'javascript']
   * so remote or sandboxed content can't inject executable tags.
   */
  inertHandlerOutput?: string[]
  fetchOptions?: RequestInit
  /**
   * Hostnames the fetch tag is allowed to request (exact match,
   * case-insensitive). When provided, every other host is rejected — this is
   * the recommended safeguard for attacker-controllable templates. When
   * omitted, all hosts are allowed except loopback, private, link-local and
   * metadata IP literals plus `localhost` names.
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
