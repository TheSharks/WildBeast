/**
 * Runtime flags owned by WildBeast. The provider may decide their values,
 * but their types, safe defaults and lifecycle metadata live with the code
 * that consumes them. This keeps misspelled/ad-hoc flag keys out of feature
 * code and makes adding a command or task gate an explicit review decision.
 */

export type FlagTarget =
  | 'environment'
  | 'guild'
  | 'user'
  | 'tier'
  | 'command'
  | 'task'

interface FlagDefinitionBase {
  description: string
  owner: string
  targets: readonly FlagTarget[]
  /** ISO date after which a temporary flag should be removed or renewed. */
  expiresAt?: string
}

export interface GateFlagDefinition extends FlagDefinitionBase {
  kind: 'gate'
  type: 'boolean'
  defaultValue: boolean
  surface: 'command' | 'task'
}

export interface ExperimentFlagDefinition<Variant extends string = string>
  extends FlagDefinitionBase {
  kind: 'experiment'
  type: 'string'
  defaultValue: Variant
  variants: readonly Variant[]
  surface: 'command'
}

export type FlagDefinition = GateFlagDefinition | ExperimentFlagDefinition

const interactionTargets = [
  'environment',
  'guild',
  'user',
  'tier',
  'command',
] as const

function commandGate(name: string): GateFlagDefinition {
  return {
    kind: 'gate',
    type: 'boolean',
    defaultValue: true,
    surface: 'command',
    description: `Whether /${name} may run`,
    owner: 'discord',
    targets: interactionTargets,
  }
}

/**
 * Default-on gates for command pieces, keyed by piece name. Adding a
 * command means adding its name here — the framework structure test fails
 * until it appears.
 */
function commandGates<const Names extends readonly string[]>(
  names: Names,
): {
  [Name in Names[number] as `features.commands.${Name}`]: GateFlagDefinition
} {
  return Object.fromEntries(
    names.map((name) => [`features.commands.${name}`, commandGate(name)]),
  ) as {
    [Name in Names[number] as `features.commands.${Name}`]: GateFlagDefinition
  }
}

function guildTagCommandsGate(): GateFlagDefinition {
  return {
    kind: 'gate',
    type: 'boolean',
    defaultValue: true,
    surface: 'command',
    description: 'Whether promoted guild tag commands may run',
    owner: 'discord',
    targets: interactionTargets,
  }
}

function taskGate(description: string): GateFlagDefinition {
  return {
    kind: 'gate',
    type: 'boolean',
    defaultValue: true,
    surface: 'task',
    description,
    owner: 'platform',
    targets: ['environment', 'task'],
  }
}

function experiment<const Variants extends readonly [string, ...string[]]>(
  definition: Omit<
    ExperimentFlagDefinition<Variants[number]>,
    'kind' | 'type'
  > & {
    variants: Variants
  },
): ExperimentFlagDefinition<Variants[number]> {
  return { kind: 'experiment', type: 'string', ...definition }
}

export const flagRegistry = {
  ...commandGates([
    '8ball',
    'advice',
    'booru',
    'cat',
    'dice',
    'dog',
    'flags',
    'info',
    'inspire',
    'invite',
    'ping',
    'tag',
    'urbandictionary',
  ]),
  'features.tasks.bullMQMetrics': taskGate(
    'Whether BullMQ queue metrics collection may run',
  ),
  'features.tasks.metricsCollection': taskGate(
    'Whether runtime and Discord metrics collection may run',
  ),
  'features.tasks.guildTagCommandReconcile': taskGate(
    'Whether promoted guild tag command reconciliation may run',
  ),
  // Promoted guild tag commands run outside any Sapphire command piece, so
  // the tag command's gate can't cover them; this one does.
  'features.tags.guildCommands': guildTagCommandsGate(),
  'experiments.tags.notFoundReply': experiment({
    defaultValue: 'suggestion',
    variants: ['plain', 'suggestion'],
    surface: 'command',
    description:
      'Whether a missing tag reply includes the closest matching tag name',
    owner: 'discord',
    targets: interactionTargets,
    expiresAt: '2027-01-31',
  }),
} as const satisfies Record<string, FlagDefinition>

export type FlagKey = keyof typeof flagRegistry

type KeysOfKind<Kind extends FlagDefinition['kind']> = {
  [Key in FlagKey]: (typeof flagRegistry)[Key] extends { kind: Kind }
    ? Key
    : never
}[FlagKey]

export type GateFlagKey = KeysOfKind<'gate'>
export type ExperimentFlagKey = KeysOfKind<'experiment'>
export type CommandGateFlagKey = Extract<
  GateFlagKey,
  `features.commands.${string}`
>
export type TaskGateFlagKey = Extract<GateFlagKey, `features.tasks.${string}`>

export type ExperimentVariant<Key extends ExperimentFlagKey> =
  (typeof flagRegistry)[Key] extends ExperimentFlagDefinition<infer Variant>
    ? Variant
    : never

export const flagKeys = Object.keys(flagRegistry) as FlagKey[]

export function getFlagDefinition<Key extends FlagKey>(
  key: Key,
): (typeof flagRegistry)[Key] {
  return flagRegistry[key]
}

export function commandGateKey(
  commandName: string,
): CommandGateFlagKey | undefined {
  const key = `features.commands.${commandName}`
  const definition = (flagRegistry as Record<string, FlagDefinition>)[key]
  return definition?.kind === 'gate' && definition.surface === 'command'
    ? (key as CommandGateFlagKey)
    : undefined
}

export function taskGateKey(taskName: string): TaskGateFlagKey | undefined {
  const key = `features.tasks.${taskName}`
  const definition = (flagRegistry as Record<string, FlagDefinition>)[key]
  return definition?.kind === 'gate' && definition.surface === 'task'
    ? (key as TaskGateFlagKey)
    : undefined
}

export function expiredFlagKeys(now = new Date()): FlagKey[] {
  return flagKeys.filter((key) => {
    const expiresAt = getFlagDefinition(key).expiresAt
    return expiresAt !== undefined && Date.parse(expiresAt) <= now.getTime()
  })
}
