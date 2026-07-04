/// <reference types="node" />
import { BlockList, isIP } from 'node:net'
import { RenderError } from '../runtime/errors.js'
import { renderSegment } from '../runtime/renderer.js'
import type { LazyTagHandler, RenderContext } from '../types.js'

// Loopback, private, link-local and cloud-metadata ranges that must never be
// reachable through the fetch tag. BlockList resolves IPv4-mapped IPv6 forms
// (e.g. ::ffff:127.0.0.1) against the IPv4 rules automatically.
const blockedRanges = new BlockList()
blockedRanges.addSubnet('0.0.0.0', 8, 'ipv4')
blockedRanges.addSubnet('10.0.0.0', 8, 'ipv4')
blockedRanges.addSubnet('100.64.0.0', 10, 'ipv4')
blockedRanges.addSubnet('127.0.0.0', 8, 'ipv4')
blockedRanges.addSubnet('169.254.0.0', 16, 'ipv4')
blockedRanges.addSubnet('172.16.0.0', 12, 'ipv4')
blockedRanges.addSubnet('192.168.0.0', 16, 'ipv4')
blockedRanges.addAddress('::1', 'ipv6')
blockedRanges.addSubnet('fe80::', 10, 'ipv6')
blockedRanges.addSubnet('fc00::', 7, 'ipv6')

const FETCH_TIMEOUT_MS = 10_000

function assertUrlAllowed(raw: string, allowedHosts?: string[]): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new RenderError(`Invalid fetch URL: ${raw}`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RenderError(`Blocked fetch URL scheme: ${url.protocol}`)
  }

  const hostname = url.hostname.toLowerCase()

  // When the embedder supplies an allowlist it is the sole authority: only the
  // listed hostnames may be reached, everything else is rejected.
  if (allowedHosts) {
    if (!allowedHosts.some((host) => host.toLowerCase() === hostname)) {
      throw new RenderError(`Fetch host not in allowlist: ${hostname}`)
    }
    return url
  }

  // localhost / *.localhost always resolve to a loopback target.
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new RenderError(`Blocked fetch to private host: ${hostname}`)
  }

  // IPv6 literals arrive wrapped in brackets, e.g. [::1].
  const literal =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname
  const family = isIP(literal)
  if (family === 4 && blockedRanges.check(literal, 'ipv4')) {
    throw new RenderError(`Blocked fetch to private address: ${literal}`)
  }
  if (family === 6 && blockedRanges.check(literal, 'ipv6')) {
    throw new RenderError(`Blocked fetch to private address: ${literal}`)
  }

  // NOTE: DNS-rebinding limitation. Non-literal hostnames are not checked
  // against the block ranges because pinning the resolved address would need a
  // custom DNS lookup / agent, which is out of scope here. A hostname that
  // resolves to a private address can therefore still be reached. Use
  // fetchAllowedHosts to lock this down for untrusted templates.
  return url
}

async function readCapped(
  response: Response,
  maxLength: number,
): Promise<string> {
  const body = response.body
  if (!body) {
    return ''
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let result = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      result += decoder.decode(value, { stream: true })
      if (result.length > maxLength) {
        throw new RenderError(
          `Fetch response exceeded maximum length of ${maxLength} characters`,
        )
      }
    }
  } finally {
    // Cancel the stream to release the connection; ignore cancel errors.
    await reader.cancel().catch(() => undefined)
  }
  result += decoder.decode()
  return result
}

export const fetchHandler: LazyTagHandler = async (
  ctx: RenderContext,
  args,
  limits,
  depth = 0,
) => {
  if (!ctx.options.enableFetch) {
    throw new RenderError('Fetch tag is disabled in the current context')
  }

  const [urlArg, verbArg] = args

  const { output: url } = await renderSegment(
    urlArg,
    ctx,
    '',
    limits,
    depth + 1,
  )
  const { output: verb } = verbArg
    ? await renderSegment(verbArg, ctx, '', limits, depth + 1)
    : { output: 'GET' }

  const target = assertUrlAllowed(url, ctx.options.fetchAllowedHosts)

  if (ctx.fetchRequests >= limits.maxFetchRequests) {
    throw new RenderError(
      `Exceeded maximum fetch requests of ${limits.maxFetchRequests}`,
    )
  }

  ctx.fetchRequests++

  const callerOptions = ctx.options.fetchOptions ?? {}
  // Merge headers so the default User-Agent survives unless the embedder
  // replaces it. Spread callerOptions last: embedder-provided options are
  // trusted and may override the tag's method, but the tag cannot override
  // them.
  const headers = {
    'User-Agent': '@TheSharks/TagScript/1.0 #github.com/TheSharks/WildBeast',
    ...((callerOptions.headers as Record<string, string> | undefined) ?? {}),
  }
  const requestInit: RequestInit = {
    method: verb.toUpperCase(),
    ...callerOptions,
    headers,
    signal: callerOptions.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }

  const response = await fetch(target, requestInit)
  if (!response.ok) {
    throw new RenderError(`Fetch request failed with status ${response.status}`)
  }

  return await readCapped(response, limits.maxOutputLength)
}
