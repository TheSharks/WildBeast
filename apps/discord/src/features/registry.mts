/**
 * Runtime flags owned by WildBeast. The provider may decide their values,
 * but their types, safe defaults and lifecycle metadata live with the code
 * that consumes them.
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

/** Operator-tuned string value; no variants, any string is accepted. */
export interface SettingFlagDefinition extends FlagDefinitionBase {
  kind: 'setting'
  type: 'string'
  defaultValue: string
}

export type FlagDefinition =
  | GateFlagDefinition
  | ExperimentFlagDefinition
  | SettingFlagDefinition

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
  > & { variants: Variants },
): ExperimentFlagDefinition<Variants[number]> {
  return { kind: 'experiment', type: 'string', ...definition }
}

/** Command names are Sapphire piece names; a command without a gate fails the structure test. */
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
  'features.tasks.metricsCollection': taskGate(
    'Whether runtime and Discord metrics collection may run',
  ),
  'features.tasks.guildTagCommandReconcile': taskGate(
    'Whether promoted guild tag command reconciliation may run',
  ),
  'features.tasks.entitlementRefresh': taskGate(
    'Whether the periodic full entitlement snapshot may run',
  ),
  'features.tasks.operatorCommandReconcile': taskGate(
    'Whether operator command placement may be reconciled',
  ),
  'features.tasks.bullMQMetrics': taskGate(
    'Whether BullMQ queue metrics collection may run',
  ),
  // Promoted guild tag commands run outside any Sapphire command piece.
  'features.tags.guildCommands': {
    kind: 'gate',
    type: 'boolean',
    defaultValue: true,
    surface: 'command',
    description: 'Whether promoted guild tag commands may run',
    owner: 'discord',
    targets: interactionTargets,
  },
  'operators.commandGuilds': {
    kind: 'setting',
    type: 'string',
    defaultValue: '',
    description:
      'Comma-separated guild ids where operator commands are placed; merged with WILDBEAST_OPERATOR_GUILD_IDS',
    owner: 'platform',
    targets: ['environment'],
  },
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
export type SettingFlagKey = KeysOfKind<'setting'>
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
    const expiresAt = (getFlagDefinition(key) as FlagDefinition).expiresAt
    return expiresAt !== undefined && Date.parse(expiresAt) <= now.getTime()
  })
}
