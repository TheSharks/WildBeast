import type { ApplicationCommandRegistry, Command } from '@sapphire/framework'

export interface RegistrationDefaults {
  hints: readonly string[]
  /** Dev guild registration makes iterations show up instantly. */
  devGuildId: bigint | null
}

export function withRegistrationDefaults(
  registry: ApplicationCommandRegistry,
  defaults: RegistrationDefaults,
): ApplicationCommandRegistry {
  const devGuildId = defaults.devGuildId?.toString()
  if (defaults.hints.length === 0 && !devGuildId) return registry
  return new Proxy(registry, {
    get(target, property, receiver) {
      if (
        property === 'registerChatInputCommand' ||
        property === 'registerContextMenuCommand'
      ) {
        return (
          command: never,
          options?: ApplicationCommandRegistry.RegisterOptions,
        ) => {
          target[property](command, {
            ...(devGuildId ? { guildIds: [devGuildId] } : {}),
            ...options,
            idHints: [
              ...new Set([...(options?.idHints ?? []), ...defaults.hints]),
            ],
          })
          return receiver
        }
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

/** Route a command's registration through stored id hints. */
export function installRegistrationDefaults(
  command: Command,
  resolve: (command: Command) => Promise<RegistrationDefaults>,
): void {
  const register = command.registerApplicationCommands?.bind(command)
  if (!register) return
  command.registerApplicationCommands = async (registry) =>
    register(withRegistrationDefaults(registry, await resolve(command)))
}
