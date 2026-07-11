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
const MAX_REDIRECTS = 5

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

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

  const url = urlArg
    ? await renderSegment(urlArg, ctx, '', limits, depth + 1)
    : ''
  const verb = verbArg
    ? await renderSegment(verbArg, ctx, '', limits, depth + 1)
    : 'GET'

  const target = assertUrlAllowed(url, ctx.options.fetchAllowedHosts)

  if (ctx.fetchRequests >= limits.maxFetchRequests) {
    throw new RenderError(
      `Exceeded maximum fetch requests of ${limits.maxFetchRequests}`,
    )
  }

  ctx.fetchRequests++

  const callerOptions = ctx.options.fetchOptions ?? {}
  // Headers normalizes every HeadersInit form (plain object, Headers
  // instance, tuple array). The default User-Agent survives unless the
  // embedder supplies its own.
  const headers = new Headers(callerOptions.headers)
  if (!headers.has('user-agent')) {
    headers.set(
      'User-Agent',
      '@TheSharks/TagScript/1.0 #github.com/TheSharks/WildBeast',
    )
  }
  // The timeout signal is created once so it caps the whole redirect chain,
  // not each hop individually.
  const signal = callerOptions.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS)

  // Redirects are followed manually so every hop is validated against the
  // same scheme/allowlist/private-address rules as the initial URL. Native
  // fetch would follow them silently, letting an allowed public host bounce
  // the request to localhost, metadata services, or a non-allowlisted host.
  let currentUrl = target
  let method = verb.toUpperCase()
  let response: Response

  for (let hop = 0; ; hop++) {
    // Spread callerOptions first: embedder-provided options are trusted and
    // may override the tag's method, but redirect handling stays manual.
    response = await fetch(currentUrl, {
      method,
      ...callerOptions,
      headers,
      signal,
      redirect: 'manual',
    })

    if (!REDIRECT_STATUSES.has(response.status)) {
      break
    }

    await response.body?.cancel().catch(() => undefined)

    if (hop >= MAX_REDIRECTS) {
      throw new RenderError(
        `Fetch exceeded maximum of ${MAX_REDIRECTS} redirects`,
      )
    }

    const location = response.headers.get('location')
    if (!location) {
      throw new RenderError(
        `Fetch request failed with status ${response.status}`,
      )
    }

    let resolved: URL
    try {
      resolved = new URL(location, currentUrl)
    } catch {
      throw new RenderError(`Invalid fetch redirect URL: ${location}`)
    }
    currentUrl = assertUrlAllowed(resolved.href, ctx.options.fetchAllowedHosts)

    // Standard redirect semantics: 303 always switches to GET, and browsers
    // treat 301/302 POSTs the same way.
    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) &&
        method === 'POST')
    ) {
      method = 'GET'
    }
  }

  if (!response.ok) {
    throw new RenderError(`Fetch request failed with status ${response.status}`)
  }

  return await readCapped(response, limits.maxOutputLength)
}
