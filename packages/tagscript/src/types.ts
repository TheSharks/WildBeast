export interface Limits {
  /** Template re-executions per render ({eval}, stored tags). */
  maxIterations: number
  maxOutputLength: number
  maxDepth: number
  regexPatternLength: number
  maxRegexInputLength: number
  maxFetchRequests: number
  /** Regex evaluations ({if} ?, {replaceregex}) per render. */
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
  /** Full avatar URL; {avatar} returns verbatim when set. */
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
  /** Expansions so far (bounded by maxIterations). */
  expansions: number
  /** Regex evals so far (bounded by maxRegexOperations). */
  regexOperations: number
  /** Handler-produced attachment surfaced on RenderResult. */
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
   * Allowed fetch hosts (exact, case-insensitive); omitted allows all except SSRF literals/localhost, with every redirect revalidated.
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
