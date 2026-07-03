import type { ILogger } from '@sapphire/framework'

/** A logger that swallows everything; for pieces under test. */
export const silentLogger: ILogger = {
  has: () => false,
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  write: () => undefined,
}
