export interface Tag {
  id: number
  guildId: bigint
  name: string
  content: string
  authorId: bigint
  commandId: bigint | null
  commandDescription: string | null
  promotedBy: bigint | null
  promotedAt: Date | null
}

export interface CommandIntent {
  id: number
  tagId: number | null
  guildId: bigint
  name: string
  description: string
  argsDescription: string
  requestedBy: bigint
  requestedAt: Date
  wanted: boolean
  attempted: boolean
  commandId: bigint | null
}

/** Methods on this surface always operate inside the repository's guild lock. */
export interface GuildTags {
  find(name: string): Promise<Tag | undefined>
  count(): Promise<number>
  create(input: {
    name: string
    content: string
    authorId: bigint
  }): Promise<Tag | undefined>
  edit(id: number, content: string): Promise<void>
  /** Atomically retain command cleanup intent and remove the tag. */
  remove(id: number): Promise<void>
  intents(): Promise<CommandIntent[]>
  request(
    input: Omit<
      CommandIntent,
      'id' | 'guildId' | 'commandId' | 'attempted' | 'wanted'
    >,
  ): Promise<void>
  withdraw(intentId: number): Promise<void>
  markAttempted(intentId: number): Promise<void>
  /** Atomically bind both intent and the legacy tag command fields. */
  bind(intent: CommandIntent, commandId: bigint): Promise<void>
  /** Called only after Discord confirms deletion or absence. */
  forget(intent: CommandIntent): Promise<void>
}

export interface TagRepository {
  /** Session lock covers workflows, but no DB transaction spans a REST call. */
  withGuild<T>(
    guildId: bigint,
    work: (tags: GuildTags) => Promise<T>,
  ): Promise<T>
  find(guildId: bigint, name: string): Promise<Tag | undefined>
  byCommand(guildId: bigint, commandId: bigint): Promise<Tag | undefined>
  list(guildId: bigint, authorId?: bigint): Promise<Tag[]>
  search(
    guildId: bigint,
    text: string,
    promotedOnly: boolean,
  ): Promise<string[]>
  suggest(guildId: bigint, text: string): Promise<string | undefined>
  guildsWithIntents(): Promise<bigint[]>
}

export interface RemoteTagCommand {
  id: bigint
  name: string
  description: string
  /** True only if the command has exactly our optional string args option. */
  tagShape: boolean
  argsDescription: string | null
}

export interface TagCommandGateway {
  list(guildId: bigint): Promise<RemoteTagCommand[]>
  create(guildId: bigint, intent: CommandIntent): Promise<bigint>
  update(
    guildId: bigint,
    commandId: bigint,
    intent: CommandIntent,
  ): Promise<void>
  delete(guildId: bigint, commandId: bigint): Promise<void>
}

export function commandName(
  name: string,
  reserved: ReadonlySet<string>,
):
  | { ok: true; name: string }
  | { ok: false; reason: 'invalidName' | 'reserved' } {
  const normalized = name.toLowerCase()
  if (!/^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u.test(normalized)) {
    return { ok: false, reason: 'invalidName' }
  }
  if (reserved.has(normalized)) return { ok: false, reason: 'reserved' }
  return { ok: true, name: normalized }
}

export function matchesIntent(
  command: RemoteTagCommand,
  intent: CommandIntent,
): boolean {
  return (
    command.tagShape &&
    command.name === intent.name &&
    command.description === intent.description &&
    command.argsDescription === intent.argsDescription
  )
}
