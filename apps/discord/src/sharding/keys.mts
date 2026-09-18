import { createHash } from 'node:crypto'

// Redis key prefixes. This module stays free of other app imports: the
// configuration needs it before telemetry starts, and a module loaded that
// early must not create metric instruments.

// Per-bot lock namespace (hashed token, never raw — PII); WILDBEAST_CLUSTER wins when set.
// feat/v9 changed this prefix: interim mixed fleets throttle independently (accepted, no fallback).
export function identifyKeyPrefix(
  token?: string,
  namespaceEnv?: string,
  base = 'wildbeast',
): string {
  const namespace = namespaceEnv ?? process.env.WILDBEAST_CLUSTER
  if (namespace) return `${base}:${namespace}:identify`
  const secret = token ?? process.env.DISCORD_TOKEN
  if (!secret) return `${base}:identify`
  const hash = createHash('sha256').update(secret).digest('hex').slice(0, 12)
  return `${base}:${hash}:identify`
}
